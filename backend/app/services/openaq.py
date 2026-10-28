import logging
import math
import re
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Set
import httpx

from app.core.config import settings
from app.core.standards import REVIEWED_ADVISORIES, VERIFIED_STANDARDS, WHO_AQG_URL
from app.schemas.air_quality import (
    AssessmentStatus,
    Coordinates,
    FreshnessState,
    LocationDetail,
    LocationMeasurementsResponse,
    LocationSummary,
    MeasurementPoint,
    MitigationAdvisory,
    ProviderStatus,
    RiskAssessmentResponse,
    SensorSummary,
)

logger = logging.getLogger(__name__)


class OpenAQServiceError(Exception):
    """Base exception for OpenAQ provider errors."""
    def __init__(
        self,
        message: str,
        status_code: int = 502,
        error_code: str = "UPSTREAM_ERROR",
        instructions: Optional[str] = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.instructions = instructions


class OpenAQMissingKeyError(OpenAQServiceError):
    """Raised when the OpenAQ API key is not configured."""
    def __init__(self):
        super().__init__(
            message="OpenAQ API key is not configured on the EcoSentinel backend.",
            status_code=503,
            error_code="MISSING_API_KEY",
            instructions=(
                "Register for a free OpenAQ API key at https://explore.openaq.org/register "
                "and set OPENAQ_API_KEY in your local .env configuration file."
            ),
        )


def get_station_timezone(tz_name: Optional[str] = "Asia/Kolkata") -> timezone:
    """Returns a timezone object for the station, with fallback to IST (+05:30) on platforms without tzdata."""
    if tz_name and tz_name.strip():
        norm = tz_name.strip()
        if norm in ("Asia/Kolkata", "Asia/Calcutta", "IST"):
            return timezone(timedelta(hours=5, minutes=30))
        try:
            from zoneinfo import ZoneInfo
            return ZoneInfo(norm)
        except Exception:
            pass
    return timezone(timedelta(hours=5, minutes=30))


def to_local_iso(dt_utc: datetime, tz_name: Optional[str] = "Asia/Kolkata") -> str:
    """Converts a UTC datetime to local ISO-8601 string using the station timezone."""
    tz = get_station_timezone(tz_name)
    return dt_utc.astimezone(tz).isoformat()


def parse_sampling_interval_seconds(interval_str: Optional[str] = None, period_label: Optional[str] = "hour") -> int:
    """Parses an interval string (e.g. '01:00:00', '00:15:00') or period label into seconds."""
    if interval_str:
        parts = interval_str.strip().split(":")
        if len(parts) == 3:
            try:
                hours = int(parts[0])
                minutes = int(parts[1])
                seconds = int(parts[2])
                total = hours * 3600 + minutes * 60 + seconds
                if total > 0:
                    return total
            except ValueError:
                pass
    if period_label:
        label = period_label.lower().strip()
        if "day" in label:
            return 86400
        elif "min" in label:
            return 900
        elif "hour" in label:
            return 3600
    return 3600


# Known coordinates for major Indian metropolitan areas to optimize OpenAQ geo-queries
INDIAN_CITY_COORDINATES: Dict[str, tuple] = {
    "chennai": ("13.0827", "80.2707"),
    "delhi": ("28.6139", "77.2090"),
    "mumbai": ("19.0760", "72.8777"),
    "bengaluru": ("12.9716", "77.5946"),
    "bangalore": ("12.9716", "77.5946"),
    "kolkata": ("22.5726", "88.3639"),
    "hyderabad": ("17.3850", "78.4867"),
}

# Canonical aliases for major Indian metropolitan and regional names
TOKEN_ALIASES: Dict[str, Set[str]] = {
    "bangalore": {"bengaluru", "bangalore"},
    "bengaluru": {"bengaluru", "bangalore"},
    "bombay": {"mumbai", "bombay"},
    "mumbai": {"mumbai", "bombay"},
    "calcutta": {"kolkata", "calcutta"},
    "kolkata": {"kolkata", "calcutta"},
    "madras": {"chennai", "madras"},
    "chennai": {"chennai", "madras"},
}


def normalize_tokens(text: str) -> List[str]:
    """Extracts lowercase alphanumeric tokens, stripping punctuation and collapsing whitespace."""
    if not text:
        return []
    cleaned = re.sub(r"[^\w\s]", " ", text, flags=re.UNICODE)
    return [t for t in cleaned.lower().split() if t]


def matches_station(
    query: str,
    station_name: str,
    locality: Optional[str] = None,
    provider: Optional[str] = None,
    owner: Optional[str] = None,
) -> bool:
    """Matches a search query against a station's metadata using token-based normalization.

    Requires every meaningful query token to be accounted for.
    Supports token reordering, punctuation/whitespace insensitivity, and explicit canonical aliases.
    """
    q_tokens = normalize_tokens(query)
    if not q_tokens:
        return True

    target_str = f"{station_name} {locality or ''} {provider or ''} {owner or ''}"
    target_tokens = set(normalize_tokens(target_str))

    # Allow query phrase 'new delhi' to match 'delhi' in target
    skip_indices: Set[int] = set()
    for i in range(len(q_tokens) - 1):
        if q_tokens[i] == "new" and q_tokens[i + 1] == "delhi" and "delhi" in target_tokens:
            skip_indices.add(i)

    for i, tok in enumerate(q_tokens):
        if i in skip_indices:
            continue
        if tok in target_tokens:
            continue
        aliases = TOKEN_ALIASES.get(tok)
        if aliases and any(a in target_tokens for a in aliases):
            continue
        return False
    return True


def _has_more_pages(meta: Any, current_page: int, page_limit: int, results_count: int) -> bool:
    """Safely determines if further upstream pages exist, handling missing or nonnumeric metadata."""
    if results_count < page_limit:
        return False

    if not isinstance(meta, dict):
        return True

    raw_found = meta.get("found")
    if raw_found is None:
        return True

    total_found: Optional[int] = None
    if isinstance(raw_found, (int, float)):
        try:
            total_found = int(raw_found)
        except (ValueError, OverflowError):
            pass
    elif isinstance(raw_found, str):
        cleaned = raw_found.strip()
        if cleaned.isdigit():
            try:
                total_found = int(cleaned)
            except ValueError:
                pass

    if total_found is not None:
        if current_page * page_limit >= total_found:
            return False

    return True


class OpenAQClient:
    """Server-side client for OpenAQ API v3."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        timeout_seconds: Optional[float] = None,
    ):
        self.api_key = api_key or settings.OPENAQ_API_KEY
        self.base_url = (base_url or settings.OPENAQ_BASE_URL).rstrip("/")
        self.timeout = timeout_seconds or settings.OPENAQ_TIMEOUT_SECONDS

    def is_configured(self) -> bool:
        """Returns True if an API key is non-empty."""
        return bool(self.api_key and self.api_key.strip())

    def _get_headers(self) -> Dict[str, str]:
        """Constructs authentication headers. Never logs the key."""
        headers = {
            "Accept": "application/json",
            "User-Agent": f"EcoSentinel/{settings.VERSION} (+https://ecosentinel.local)",
        }
        if self.is_configured():
            headers["X-API-Key"] = self.api_key.strip()  # type: ignore
        return headers

    async def get_provider_status(self) -> ProviderStatus:
        """Checks upstream provider reachability and configuration status."""
        is_configured = self.is_configured()
        is_reachable = False
        message = ""

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(
                    f"{self.base_url}/locations",
                    params={"limit": 1},
                    headers=self._get_headers(),
                )
                if resp.status_code in (200, 401, 429):
                    is_reachable = True

                if not is_configured:
                    message = "Provider API reachable, but OPENAQ_API_KEY is not configured in backend environment."
                elif resp.status_code == 200:
                    message = "OpenAQ API v3 is configured and reachable."
                elif resp.status_code == 401:
                    message = "OpenAQ API returned 401 Unauthorized. The configured API key may be invalid."
                elif resp.status_code == 429:
                    message = "OpenAQ API rate limit reached (60 req/min or 2,000 req/hour)."
                else:
                    message = f"OpenAQ API returned HTTP {resp.status_code}."
        except Exception as exc:
            logger.warning("Failed to reach OpenAQ API: %s", exc)
            message = f"Cannot reach OpenAQ API at {self.base_url}: {str(exc)}"

        return ProviderStatus(
            provider="OpenAQ v3",
            is_configured=is_configured,
            is_reachable=is_reachable,
            base_url=self.base_url,
            message=message,
            key_instructions="Obtain a free API key at https://explore.openaq.org/register and add OPENAQ_API_KEY to your .env file.",
        )

    def _handle_response_error(self, response: httpx.Response) -> None:
        """Translates HTTP error status codes into structured service exceptions."""
        if response.status_code in (401, 403):
            raise OpenAQServiceError(
                message="OpenAQ authentication failed. The configured API key was rejected by the upstream provider.",
                status_code=502,
                error_code="UPSTREAM_AUTH_ERROR",
                instructions="Verify that your OPENAQ_API_KEY in .env is valid and active at https://explore.openaq.org/account.",
            )
        elif response.status_code == 429:
            raise OpenAQServiceError(
                message="OpenAQ rate limit exceeded (Free tier allows 60 requests/minute and 2,000 requests/hour).",
                status_code=429,
                error_code="RATE_LIMIT_EXCEEDED",
                instructions="Please wait a moment before retrying your investigation request.",
            )
        elif response.status_code == 404:
            raise OpenAQServiceError(
                message="The requested monitoring location or sensor was not found in OpenAQ.",
                status_code=404,
                error_code="NOT_FOUND",
            )
        elif response.status_code >= 500:
            raise OpenAQServiceError(
                message=f"OpenAQ upstream service error (HTTP {response.status_code}).",
                status_code=502,
                error_code="UPSTREAM_SERVER_ERROR",
                instructions="The OpenAQ platform may be experiencing temporary service degradation.",
            )
        else:
            raise OpenAQServiceError(
                message=f"OpenAQ returned unexpected status HTTP {response.status_code}: {response.text[:200]}",
                status_code=502,
                error_code="UPSTREAM_ERROR",
            )

    async def get_locations(
        self,
        country: str = "IN",
        search: Optional[str] = None,
        limit: int = 100,
        page: int = 1,
    ) -> List[LocationSummary]:
        """Queries OpenAQ v3 locations for a given country ISO code with optional search filtering and bounded pagination."""
        if not self.is_configured():
            raise OpenAQMissingKeyError()

        # If search matches a recognized Indian metropolitan area, use coordinates with 25km radius
        city_coords = None
        if search and search.strip():
            query = search.strip().lower()
            for city_key, coords in INDIAN_CITY_COORDINATES.items():
                if city_key in query:
                    city_coords = coords
                    break

        base_params: Dict[str, Any] = {
            "order_by": "id",
            "sort_order": "desc",
        }
        if city_coords:
            base_params["coordinates"] = f"{city_coords[0]},{city_coords[1]}"
            base_params["radius"] = 25000
        else:
            base_params["iso"] = country.upper()

        MAX_PAGE_BUDGET = 3
        page_limit = min(max(limit, 1), 100)
        start_page = max(page, 1)

        raw_results_by_id: Dict[int, dict] = {}
        pages_to_fetch = MAX_PAGE_BUDGET if (search and search.strip()) else 1

        for page_offset in range(pages_to_fetch):
            current_page = start_page + page_offset
            page_params = dict(base_params)
            page_params["page"] = current_page
            page_params["limit"] = page_limit

            try:
                async with httpx.AsyncClient(timeout=self.timeout) as client:
                    response = await client.get(
                        f"{self.base_url}/locations",
                        params=page_params,
                        headers=self._get_headers(),
                    )
            except httpx.TimeoutException:
                if page_offset == 0:
                    raise OpenAQServiceError(
                        message="Request to OpenAQ timed out while searching locations.",
                        status_code=504,
                        error_code="UPSTREAM_TIMEOUT",
                    )
                logger.warning(
                    "Timeout contacting OpenAQ on page %d; preserving %d collected records",
                    current_page,
                    len(raw_results_by_id),
                )
                break
            except httpx.RequestError as exc:
                if page_offset == 0:
                    raise OpenAQServiceError(
                        message=f"Network error contacting OpenAQ: {str(exc)}",
                        status_code=502,
                        error_code="NETWORK_ERROR",
                    )
                logger.warning(
                    "Network error contacting OpenAQ on page %d (%s); preserving %d collected records",
                    current_page,
                    exc,
                    len(raw_results_by_id),
                )
                break

            if not response.is_success:
                if page_offset == 0:
                    self._handle_response_error(response)
                logger.warning(
                    "Upstream error HTTP %d on page %d; preserving %d collected records",
                    response.status_code,
                    current_page,
                    len(raw_results_by_id),
                )
                break

            try:
                data = response.json()
            except Exception as exc:
                if page_offset == 0:
                    raise OpenAQServiceError(
                        message=f"Malformed JSON response from OpenAQ: {str(exc)}",
                        status_code=502,
                        error_code="UPSTREAM_ERROR",
                    )
                logger.warning(
                    "Malformed JSON on page %d; preserving %d collected records",
                    current_page,
                    len(raw_results_by_id),
                )
                break

            page_results = data.get("results", [])
            if not isinstance(page_results, list) or not page_results:
                break

            for item in page_results:
                if isinstance(item, dict):
                    loc_id = item.get("id")
                    if loc_id is not None and loc_id not in raw_results_by_id:
                        raw_results_by_id[loc_id] = item

            # Check if there are further pages according to OpenAQ response metadata
            meta = data.get("meta")
            if not _has_more_pages(meta, current_page, page_limit, len(page_results)):
                break

        locations: List[LocationSummary] = []
        now_utc = datetime.now(timezone.utc)
        stale_delta = timedelta(hours=settings.STALE_DATA_THRESHOLD_HOURS)

        for item in raw_results_by_id.values():
            loc_id = item.get("id")
            name = item.get("name") or f"Station {loc_id}"
            locality = item.get("locality")

            # Extract coordinates
            coords_data = item.get("coordinates")
            coords = None
            if coords_data and "latitude" in coords_data and "longitude" in coords_data:
                try:
                    coords = Coordinates(
                        latitude=float(coords_data["latitude"]),
                        longitude=float(coords_data["longitude"]),
                    )
                except (ValueError, TypeError):
                    coords = None

            # Extract provider & owner
            provider_data = item.get("provider") or {}
            provider_name = provider_data.get("name") or "Unknown Provider"
            owner_data = item.get("owner") or {}
            owner_name = owner_data.get("name")

            # Extract parameters from sensors
            sensors_list = item.get("sensors") or []
            parameters = []
            for s in sensors_list:
                param_data = s.get("parameter") or {}
                param_name = param_data.get("name")
                if param_name and param_name not in parameters:
                    parameters.append(param_name)

            # Parse last datetime
            dt_last_utc = None
            dt_last_local = None
            is_stale = False
            dt_last_obj = item.get("datetimeLast")
            if dt_last_obj and isinstance(dt_last_obj, dict):
                utc_str = dt_last_obj.get("utc")
                dt_last_local = dt_last_obj.get("local")
                if utc_str:
                    try:
                        dt_last_utc = datetime.fromisoformat(utc_str.replace("Z", "+00:00"))
                        if not dt_last_local:
                            dt_last_local = to_local_iso(dt_last_utc, "Asia/Kolkata")
                        if now_utc - dt_last_utc > stale_delta:
                            is_stale = True
                    except Exception:
                        pass

            # Search filter using normalized token matching
            if search and search.strip():
                if not matches_station(search, name, locality, provider_name, owner_name):
                    continue

            locations.append(
                LocationSummary(
                    id=loc_id,
                    name=name,
                    locality=locality,
                    country_code=item.get("country", {}).get("code", "IN") if isinstance(item.get("country"), dict) else "IN",
                    country_name=item.get("country", {}).get("name", "India") if isinstance(item.get("country"), dict) else "India",
                    provider_name=provider_name,
                    owner_name=owner_name,
                    is_monitor=bool(item.get("isMonitor", True)),
                    is_mobile=bool(item.get("isMobile", False)),
                    coordinates=coords,
                    available_parameters=parameters,
                    datetime_last_utc=dt_last_utc,
                    datetime_last_local=dt_last_local,
                    is_stale=is_stale,
                )
            )

        # Sort locations so active stations with recent observations appear first
        locations.sort(
            key=lambda loc: loc.datetime_last_utc or datetime.min.replace(tzinfo=timezone.utc),
            reverse=True,
        )

        return locations[:limit]

    async def get_location_detail(self, location_id: int) -> LocationDetail:
        """Retrieves full station metadata including all attached sensors."""
        if not self.is_configured():
            raise OpenAQMissingKeyError()

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/locations/{location_id}",
                    headers=self._get_headers(),
                )
        except httpx.TimeoutException:
            raise OpenAQServiceError(
                message=f"Request to OpenAQ timed out for location ID {location_id}.",
                status_code=504,
                error_code="UPSTREAM_TIMEOUT",
            )
        except httpx.RequestError as exc:
            raise OpenAQServiceError(
                message=f"Network error contacting OpenAQ: {str(exc)}",
                status_code=502,
                error_code="NETWORK_ERROR",
            )

        if not response.is_success:
            self._handle_response_error(response)

        data = response.json()
        results = data.get("results", [])
        if not results:
            raise OpenAQServiceError(
                message=f"Station with ID {location_id} was not found.",
                status_code=404,
                error_code="LOCATION_NOT_FOUND",
            )

        item = results[0]
        now_utc = datetime.now(timezone.utc)
        stale_delta = timedelta(hours=settings.STALE_DATA_THRESHOLD_HOURS)

        # Parse coordinates
        coords_data = item.get("coordinates")
        coords = None
        if coords_data and "latitude" in coords_data and "longitude" in coords_data:
            coords = Coordinates(
                latitude=float(coords_data["latitude"]),
                longitude=float(coords_data["longitude"]),
            )

        # Parse dates
        dt_last_utc = None
        dt_last_local = None
        is_stale = False
        dt_last_obj = item.get("datetimeLast")
        loc_tz = item.get("timezone") or "Asia/Kolkata"
        if dt_last_obj and isinstance(dt_last_obj, dict):
            utc_str = dt_last_obj.get("utc")
            dt_last_local = dt_last_obj.get("local")
            if utc_str:
                try:
                    dt_last_utc = datetime.fromisoformat(utc_str.replace("Z", "+00:00"))
                    if not dt_last_local:
                        dt_last_local = to_local_iso(dt_last_utc, loc_tz)
                    if now_utc - dt_last_utc > stale_delta:
                        is_stale = True
                except Exception:
                    pass

        dt_first_utc = None
        dt_first_obj = item.get("datetimeFirst")
        if dt_first_obj and isinstance(dt_first_obj, dict):
            first_str = dt_first_obj.get("utc")
            if first_str:
                try:
                    dt_first_utc = datetime.fromisoformat(first_str.replace("Z", "+00:00"))
                except Exception:
                    pass

        # Extract sensors - deduplicate by parameter, keeping the most active sensor per pollutant
        sensors_by_param: Dict[str, SensorSummary] = {}
        for s in (item.get("sensors") or []):
            param_data = s.get("parameter") or {}
            param_name = param_data.get("name", "unknown")

            s_first_utc = None
            s_first_local = None
            s_first_obj = s.get("datetimeFirst")
            if s_first_obj and isinstance(s_first_obj, dict):
                first_str = s_first_obj.get("utc")
                s_first_local = s_first_obj.get("local")
                if first_str:
                    try:
                        s_first_utc = datetime.fromisoformat(first_str.replace("Z", "+00:00"))
                        if not s_first_local:
                            s_first_local = to_local_iso(s_first_utc, loc_tz)
                    except Exception:
                        pass

            s_last_utc = None
            s_last_local = None
            s_last_obj = s.get("datetimeLast")
            if s_last_obj and isinstance(s_last_obj, dict):
                last_str = s_last_obj.get("utc")
                s_last_local = s_last_obj.get("local")
                if last_str:
                    try:
                        s_last_utc = datetime.fromisoformat(last_str.replace("Z", "+00:00"))
                        if not s_last_local:
                            s_last_local = to_local_iso(s_last_utc, loc_tz)
                    except Exception:
                        pass

            sensor_obj = SensorSummary(
                id=s.get("id", 0),
                name=s.get("name", param_name),
                parameter_id=param_data.get("id", 0),
                parameter_name=param_name,
                parameter_display_name=param_data.get("displayName") or param_name.upper(),
                units=param_data.get("units", "µg/m³"),
                datetime_first_utc=s_first_utc,
                datetime_first_local=s_first_local,
                datetime_last_utc=s_last_utc,
                datetime_last_local=s_last_local,
            )
            # Retain the sensor with the most recent observation, breaking ties by sensor ID
            min_dt = datetime.min.replace(tzinfo=timezone.utc)
            cand_key = (sensor_obj.datetime_last_utc or min_dt, sensor_obj.id)
            if param_name not in sensors_by_param:
                sensors_by_param[param_name] = sensor_obj
            else:
                existing_key = (sensors_by_param[param_name].datetime_last_utc or min_dt, sensors_by_param[param_name].id)
                if cand_key > existing_key:
                    sensors_by_param[param_name] = sensor_obj

        sensors = list(sensors_by_param.values())
        available_params = [s.parameter_name for s in sensors]

        # Extract instruments safely (handling None)
        instruments = [
            inst.get("name")
            for inst in (item.get("instruments") or [])
            if isinstance(inst, dict) and inst.get("name")
        ]

        provider_data = item.get("provider") or {}
        owner_data = item.get("owner") or {}

        # Safely extract licenses handling None from upstream
        raw_licenses = item.get("licenses")
        licenses_list = raw_licenses if isinstance(raw_licenses, list) else []

        return LocationDetail(
            id=item.get("id", location_id),
            name=item.get("name") or f"Station {location_id}",
            locality=item.get("locality"),
            country_code=item.get("country", {}).get("code", "IN") if isinstance(item.get("country"), dict) else "IN",
            country_name=item.get("country", {}).get("name", "India") if isinstance(item.get("country"), dict) else "India",
            provider_name=provider_data.get("name") or "Unknown Provider",
            owner_name=owner_data.get("name"),
            is_monitor=bool(item.get("isMonitor", True)),
            is_mobile=bool(item.get("isMobile", False)),
            coordinates=coords,
            available_parameters=available_params,
            datetime_last_utc=dt_last_utc,
            datetime_last_local=dt_last_local,
            is_stale=is_stale,
            timezone=item.get("timezone") or "Asia/Kolkata",
            instruments=instruments,
            licenses=licenses_list,
            datetime_first_utc=dt_first_utc,
            sensors=sensors,
        )

    async def get_sensor_detail(self, sensor_id: int) -> Optional[Dict[str, Any]]:
        """Retrieves individual sensor metadata from OpenAQ /v3/sensors/{sensor_id}.

        Returns the raw sensor dictionary from OpenAQ results, or None if unavailable.
        Logs unexpected upstream failures with context without exposing credentials.
        """
        if not self.is_configured():
            raise OpenAQMissingKeyError()

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/sensors/{sensor_id}",
                    headers=self._get_headers(),
                )

                if not response.is_success:
                    logger.warning(
                        "Upstream error HTTP %d retrieving metadata for sensor %s",
                        response.status_code,
                        sensor_id,
                    )
                    return None

                try:
                    data = response.json()
                except Exception as exc:
                    logger.warning(
                        "Failed to parse JSON response for sensor %s: %s",
                        sensor_id,
                        exc,
                    )
                    return None

                results = data.get("results", [])
                if isinstance(results, list) and results and isinstance(results[0], dict):
                    return results[0]

                logger.warning(
                    "Unexpected response structure for sensor %s: missing or empty results",
                    sensor_id,
                )
                return None

        except httpx.TimeoutException:
            logger.warning(
                "Timeout retrieving metadata for sensor %s from OpenAQ",
                sensor_id,
            )
            return None
        except httpx.RequestError as exc:
            logger.warning(
                "Network error retrieving metadata for sensor %s: %s",
                sensor_id,
                exc,
            )
            return None
        except Exception as exc:
            logger.warning(
                "Unexpected error retrieving metadata for sensor %s: %s",
                sensor_id,
                exc,
            )
            return None

    async def get_measurements(
        self,
        location_id: int,
        parameter: Optional[str] = None,
        sensor_id: Optional[int] = None,
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
        limit: int = 1000,
    ) -> LocationMeasurementsResponse:
        """Retrieves and normalizes time-series measurements for a location sensor."""
        if not self.is_configured():
            raise OpenAQMissingKeyError()

        # Step 1: Resolve station metadata and sensor
        location = await self.get_location_detail(location_id)
        if not location.sensors:
            raise OpenAQServiceError(
                message=f"Station '{location.name}' has no active sensors registered.",
                status_code=404,
                error_code="NO_SENSORS",
            )

        selected_sensor: Optional[SensorSummary] = None
        if sensor_id is not None:
            for s in location.sensors:
                if s.id == sensor_id:
                    selected_sensor = s
                    break
            if not selected_sensor:
                raise OpenAQServiceError(
                    message=f"Sensor ID {sensor_id} does not belong to station {location_id}.",
                    status_code=400,
                    error_code="INVALID_SENSOR",
                )
        elif parameter:
            norm_param = parameter.strip().lower()
            matching_sensors = [s for s in location.sensors if s.parameter_name.lower() == norm_param]
            if not matching_sensors:
                valid_params = ", ".join(location.available_parameters)
                raise OpenAQServiceError(
                    message=f"Pollutant '{parameter}' is not monitored at '{location.name}'. Available: {valid_params}",
                    status_code=400,
                    error_code="UNSUPPORTED_POLLUTANT",
                )
            # Choose the active sensor with most recent observation, breaking ties by sensor ID
            min_dt = datetime.min.replace(tzinfo=timezone.utc)
            selected_sensor = max(matching_sensors, key=lambda s: (s.datetime_last_utc or min_dt, s.id))
        else:
            # Default to PM2.5 if available, else most active sensor
            min_dt = datetime.min.replace(tzinfo=timezone.utc)
            pm25_sensors = [s for s in location.sensors if s.parameter_name.lower() in ("pm25", "pm2.5")]
            if pm25_sensors:
                selected_sensor = max(pm25_sensors, key=lambda s: (s.datetime_last_utc or min_dt, s.id))
            else:
                selected_sensor = max(location.sensors, key=lambda s: (s.datetime_last_utc or min_dt, s.id))

        # Step 2: Validate time range
        now_utc = datetime.now(timezone.utc)
        if date_to is None:
            date_to = now_utc
        elif date_to.tzinfo is None:
            date_to = date_to.replace(tzinfo=timezone.utc)

        if date_from is None:
            # Default to last 24 hours
            date_from = date_to - timedelta(hours=24)
        elif date_from.tzinfo is None:
            date_from = date_from.replace(tzinfo=timezone.utc)

        if date_from > date_to:
            raise OpenAQServiceError(
                message="date_from must be earlier than date_to.",
                status_code=400,
                error_code="INVALID_DATE_RANGE",
            )

        time_delta = date_to - date_from
        if time_delta.total_seconds() > 90 * 86400:
            raise OpenAQServiceError(
                message="Requested time range exceeds the 90-day maximum limit.",
                status_code=400,
                error_code="EXCESSIVE_TIME_RANGE",
            )

        # Step 3: Query OpenAQ /v3/sensors/{sensor_id}/hours (or /measurements fallback)
        params: Dict[str, Any] = {
            "datetime_from": date_from.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "datetime_to": date_to.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "limit": min(max(limit, 1), 1000),
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                # Query precomputed hourly aggregations first
                response = await client.get(
                    f"{self.base_url}/sensors/{selected_sensor.id}/hours",
                    params=params,
                    headers=self._get_headers(),
                )

                # If hours endpoint returns 404, try raw measurements endpoint
                if response.status_code == 404:
                    raw_resp = await client.get(
                        f"{self.base_url}/sensors/{selected_sensor.id}/measurements",
                        params=params,
                        headers=self._get_headers(),
                    )
                    if raw_resp.is_success:
                        response = raw_resp
        except httpx.TimeoutException:
            raise OpenAQServiceError(
                message=f"Timeout retrieving measurements for sensor {selected_sensor.id}.",
                status_code=504,
                error_code="UPSTREAM_TIMEOUT",
            )
        except httpx.RequestError as exc:
            raise OpenAQServiceError(
                message=f"Network error contacting OpenAQ: {str(exc)}",
                status_code=502,
                error_code="NETWORK_ERROR",
            )

        if not response.is_success:
            self._handle_response_error(response)

        results_data = response.json().get("results", [])

        # Step 4: Parse measurements points with timestamp deduplication
        deduped_points: Dict[datetime, MeasurementPoint] = {}
        detected_interval_seconds: Optional[int] = None

        for row in results_data:
            val = row.get("value")
            if val is None:
                continue

            # Period and datetimes
            period_data = row.get("period") or {}
            period_label = period_data.get("label", "hour")
            interval_str = period_data.get("interval")

            dt_from_data = period_data.get("datetimeFrom") or {}
            dt_to_data = period_data.get("datetimeTo") or {}

            utc_from_str = dt_from_data.get("utc")
            utc_to_str = dt_to_data.get("utc")

            if not utc_from_str or not utc_to_str:
                continue

            try:
                pt_from_utc = datetime.fromisoformat(utc_from_str.replace("Z", "+00:00"))
                pt_to_utc = datetime.fromisoformat(utc_to_str.replace("Z", "+00:00"))
            except Exception:
                continue

            pt_interval_sec = parse_sampling_interval_seconds(interval_str, period_label)
            if detected_interval_seconds is None and pt_interval_sec > 0:
                detected_interval_seconds = pt_interval_sec

            coverage_data = row.get("coverage") or {}
            pct_complete = coverage_data.get("percentComplete")

            local_from = dt_from_data.get("local") or to_local_iso(pt_from_utc, location.timezone)
            local_to = dt_to_data.get("local") or to_local_iso(pt_to_utc, location.timezone)

            pt = MeasurementPoint(
                value=round(float(val), 2),
                parameter=selected_sensor.parameter_name,
                units=selected_sensor.units,
                period_label=period_label,
                interval=interval_str,
                datetime_from_utc=pt_from_utc,
                datetime_to_utc=pt_to_utc,
                datetime_from_local=local_from,
                datetime_to_local=local_to,
                is_missing=False,
                percent_complete=float(pct_complete) if pct_complete is not None else None,
            )

            # Deduplicate by start timestamp: preserve record with highest coverage, do not duplicate count
            if pt_from_utc not in deduped_points:
                deduped_points[pt_from_utc] = pt
            else:
                existing = deduped_points[pt_from_utc]
                if (pt.percent_complete or 0) > (existing.percent_complete or 0):
                    deduped_points[pt_from_utc] = pt

        # Sort unique points chronologically
        points = sorted(deduped_points.values(), key=lambda p: p.datetime_from_utc)

        # Calculate coverage and missingness:
        # Accounts for the selected investigation window, sensor sampling interval, and current time.
        # Future intervals relative to now_utc cannot be expected to contain observations.
        sampling_seconds = detected_interval_seconds or 3600
        effective_to = min(date_to, now_utc)
        if effective_to <= date_from:
            expected_obs = 0
            missing_pct = 0.0
        else:
            elapsed_seconds = (effective_to - date_from).total_seconds()
            expected_obs = max(int(elapsed_seconds // sampling_seconds), 1)
            actual_obs = len(points)
            missing_pct = round(max(0.0, min(100.0, (1.0 - (actual_obs / expected_obs)) * 100)), 1)

        actual_obs = len(points)

        # Freshness is calculated strictly from the latest observation for the selected pollutant sensor
        sensor_dt_last_utc = selected_sensor.datetime_last_utc
        sensor_dt_last_local = selected_sensor.datetime_last_local

        # If points returned in this response contain a more recent observation, update it
        if points:
            latest_point = points[-1]
            if sensor_dt_last_utc is None or latest_point.datetime_to_utc > sensor_dt_last_utc:
                sensor_dt_last_utc = latest_point.datetime_to_utc
                sensor_dt_last_local = latest_point.datetime_to_local
        elif sensor_dt_last_utc is None:
            # If no observations were returned in the window and the location response lacked
            # sensor-level timestamps (standard in OpenAQ v3 /locations/{id}), resolve the sensor's
            # actual latest observation timestamp directly from the sensor endpoint.
            # Do NOT assume the station's latest observation belongs to this sensor.
            sensor_meta = await self.get_sensor_detail(selected_sensor.id)
            if sensor_meta:
                dt_last_obj = sensor_meta.get("datetimeLast")
                if dt_last_obj and isinstance(dt_last_obj, dict):
                    last_utc_str = dt_last_obj.get("utc")
                    last_local_str = dt_last_obj.get("local")
                    if last_utc_str:
                        try:
                            sensor_dt_last_utc = datetime.fromisoformat(last_utc_str.replace("Z", "+00:00"))
                            sensor_dt_last_local = last_local_str or to_local_iso(sensor_dt_last_utc, location.timezone)
                            selected_sensor.datetime_last_utc = sensor_dt_last_utc
                            selected_sensor.datetime_last_local = sensor_dt_last_local
                        except Exception:
                            pass
                dt_first_obj = sensor_meta.get("datetimeFirst")
                if dt_first_obj and isinstance(dt_first_obj, dict):
                    first_utc_str = dt_first_obj.get("utc")
                    first_local_str = dt_first_obj.get("local")
                    if first_utc_str:
                        try:
                            selected_sensor.datetime_first_utc = datetime.fromisoformat(first_utc_str.replace("Z", "+00:00"))
                            selected_sensor.datetime_first_local = first_local_str or to_local_iso(selected_sensor.datetime_first_utc, location.timezone)
                        except Exception:
                            pass

        if sensor_dt_last_utc and not sensor_dt_last_local:
            sensor_dt_last_local = to_local_iso(sensor_dt_last_utc, location.timezone)

        # Check staleness: based strictly on the selected sensor's latest observation
        is_stale = False
        stale_msg = None
        if sensor_dt_last_utc:
            diff = now_utc - sensor_dt_last_utc
            if diff > timedelta(hours=settings.STALE_DATA_THRESHOLD_HOURS):
                is_stale = True
                days = diff.days
                hours = int((diff.seconds % 86400) // 3600)
                stale_msg = f"Last observation was recorded {days}d {hours}h ago."
        else:
            # Sensor has no recorded observations
            is_stale = True
            stale_msg = f"No observation history available for {selected_sensor.parameter_display_name} sensor."

        return LocationMeasurementsResponse(
            location_id=location.id,
            station_name=location.name,
            locality=location.locality,
            provider_name=location.provider_name,
            parameter=selected_sensor.parameter_name,
            parameter_display_name=selected_sensor.parameter_display_name,
            units=selected_sensor.units,
            sensor_id=selected_sensor.id,
            sensor_datetime_last_utc=sensor_dt_last_utc,
            sensor_datetime_last_local=sensor_dt_last_local,
            requested_from_utc=date_from,
            requested_to_utc=date_to,
            retrieved_at_utc=now_utc,
            total_observations=actual_obs,
            expected_observations=expected_obs,
            missing_percentage=missing_pct,
            is_stale=is_stale,
            stale_message=stale_msg,
            data_integrity_notice=(
                "Concentration measurements reflect physical observations and do not represent calculated "
                "AQI or legal pollution causation."
            ),
            measurements=points,
        )

    async def calculate_risk_assessment(
        self,
        location_id: int,
        parameter: Optional[str] = "pm25",
        sensor_id: Optional[int] = None,
        reference_time: Optional[datetime] = None,
    ) -> RiskAssessmentResponse:
        """
        Calculates an evidence-backed operational risk assessment against statutory CPCB NAAQS (2009)
        and WHO (2021) guidelines for a specific station and criteria pollutant.

        Enforces:
        - Strict rolling window evaluation (24-hour for PM2.5, PM10, NO2, SO2; 8-hour for O3, CO).
        - EcoSentinel conservative completeness gate (minimum 75% hourly coverage required).
        - Elimination of invalid negative concentration values with data quality warnings.
        - Deduplication by time-window identity.
        - Strict derivation of freshness from the selected sensor's timestamp (not station timestamp).
        - Suppression of real-time operational mitigation alerts when data is stale, historical, or incomplete.
        - Neutral screening labels ("Below reference level", "Above reference level", "Insufficient data", "Stale data").
        """
        if not self.is_configured():
            raise OpenAQMissingKeyError()

        now_utc = reference_time if reference_time is not None else datetime.now(timezone.utc)
        if now_utc.tzinfo is None:
            now_utc = now_utc.replace(tzinfo=timezone.utc)

        # Step 1: Retrieve station metadata
        location = await self.get_location_detail(location_id)
        calc_local = to_local_iso(now_utc, location.timezone)

        # Step 2: Resolve sensor and normalize pollutant code
        target_param = (parameter or "pm25").strip().lower().replace(".", "").replace("-", "")

        selected_sensor: Optional[SensorSummary] = None
        if sensor_id is not None:
            for s in location.sensors:
                if s.id == sensor_id:
                    selected_sensor = s
                    break
        else:
            candidates = [
                s for s in location.sensors
                if s.parameter_name.lower().replace(".", "").replace("-", "") == target_param
            ]
            if candidates:
                candidates.sort(
                    key=lambda s: s.datetime_last_utc or datetime.min.replace(tzinfo=timezone.utc),
                    reverse=True,
                )
                selected_sensor = candidates[0]

        if not selected_sensor:
            display_name = target_param.upper()
            return RiskAssessmentResponse(
                location_id=location.id,
                station_name=location.name,
                locality=location.locality,
                sensor_id=None,
                parameter=target_param,
                parameter_display_name=display_name,
                units="µg/m³",
                calculation_timestamp_utc=now_utc,
                calculation_timestamp_local=calc_local,
                window_start_utc=now_utc - timedelta(hours=24),
                window_end_utc=now_utc,
                window_start_local=to_local_iso(now_utc - timedelta(hours=24), location.timezone),
                window_end_local=calc_local,
                averaging_period_hours=24,
                averaging_period_label="24-hour",
                valid_observations=0,
                expected_observations=24,
                missing_observations=24,
                excluded_observations=0,
                completeness_percentage=0.0,
                is_completeness_satisfied=False,
                data_quality_warnings=["No matching sensor found for this parameter at this station."],
                calculated_average=None,
                sensor_datetime_last_utc=None,
                sensor_datetime_last_local=None,
                freshness_state=FreshnessState.UNAVAILABLE,
                freshness_message="Sensor not available for this station and parameter.",
                status=AssessmentStatus.UNAVAILABLE,
                status_label="Unavailable",
                ratio_to_standard=None,
                screening_limitations=f"Station #{location.id} ({location.name}) does not have an active sensor registered for parameter '{target_param}'.",
                advisories=[],
            )

        # Step 3: Verified standards lookup & unit compatibility verification
        standard_cfg = VERIFIED_STANDARDS.get(target_param)
        if not standard_cfg:
            return RiskAssessmentResponse(
                location_id=location.id,
                station_name=location.name,
                locality=location.locality,
                sensor_id=selected_sensor.id,
                parameter=selected_sensor.parameter_name,
                parameter_display_name=selected_sensor.parameter_display_name,
                units=selected_sensor.units,
                calculation_timestamp_utc=now_utc,
                calculation_timestamp_local=calc_local,
                window_start_utc=now_utc - timedelta(hours=24),
                window_end_utc=now_utc,
                window_start_local=to_local_iso(now_utc - timedelta(hours=24), location.timezone),
                window_end_local=calc_local,
                averaging_period_hours=24,
                averaging_period_label="24-hour",
                valid_observations=0,
                expected_observations=24,
                missing_observations=24,
                excluded_observations=0,
                completeness_percentage=0.0,
                is_completeness_satisfied=False,
                data_quality_warnings=[f"Parameter '{target_param}' has no verified CPCB NAAQS screening standard."],
                calculated_average=None,
                sensor_datetime_last_utc=selected_sensor.datetime_last_utc,
                sensor_datetime_last_local=selected_sensor.datetime_last_local,
                freshness_state=FreshnessState.UNAVAILABLE,
                freshness_message="No verified standard configured for this parameter.",
                status=AssessmentStatus.UNSUPPORTED_PARAMETER,
                status_label="Unsupported parameter",
                ratio_to_standard=None,
                screening_limitations=f"No verified statutory screening standard is configured for pollutant '{target_param}'. EcoSentinel does not prescribe unverified thresholds.",
                advisories=[],
            )

        # Check unit compatibility (especially for CO)
        norm_unit = selected_sensor.units.lower().strip()
        unit_label = selected_sensor.units
        threshold_value = standard_cfg.cpcb_standard.threshold

        if target_param == "co":
            if norm_unit in ("ppm", "ppb"):
                return RiskAssessmentResponse(
                    location_id=location.id,
                    station_name=location.name,
                    locality=location.locality,
                    sensor_id=selected_sensor.id,
                    parameter=selected_sensor.parameter_name,
                    parameter_display_name=selected_sensor.parameter_display_name,
                    units=selected_sensor.units,
                    calculation_timestamp_utc=now_utc,
                    calculation_timestamp_local=calc_local,
                    window_start_utc=now_utc - timedelta(hours=standard_cfg.averaging_period_hours),
                    window_end_utc=now_utc,
                    window_start_local=to_local_iso(now_utc - timedelta(hours=standard_cfg.averaging_period_hours), location.timezone),
                    window_end_local=calc_local,
                    averaging_period_hours=standard_cfg.averaging_period_hours,
                    averaging_period_label=standard_cfg.averaging_period_label,
                    valid_observations=0,
                    expected_observations=standard_cfg.averaging_period_hours,
                    missing_observations=standard_cfg.averaging_period_hours,
                    excluded_observations=0,
                    completeness_percentage=0.0,
                    is_completeness_satisfied=False,
                    data_quality_warnings=["CO observations in ppm cannot be converted to mg/m³ without temperature and atmospheric pressure."],
                    calculated_average=None,
                    sensor_datetime_last_utc=selected_sensor.datetime_last_utc,
                    sensor_datetime_last_local=selected_sensor.datetime_last_local,
                    freshness_state=FreshnessState.UNAVAILABLE,
                    freshness_message="Sensor units (ppm) incompatible without ambient temperature/pressure.",
                    standard_name=standard_cfg.cpcb_standard.name,
                    standard_threshold=2.0,
                    standard_unit="mg/m³",
                    standard_url=standard_cfg.cpcb_standard.source_url,
                    secondary_benchmark_name="WHO AQG (2021)",
                    secondary_benchmark_threshold=None,
                    secondary_benchmark_unit="mg/m³",
                    secondary_benchmark_notes="WHO 2021 CO guideline (4.0 mg/m³) prescribes a 24-hour averaging period and cannot be compared to an 8-hour window.",
                    status=AssessmentStatus.UNSUPPORTED_PARAMETER,
                    status_label="Unsupported parameter unit",
                    ratio_to_standard=None,
                    screening_limitations="Sensor reports CO in ppm. Gas volume-to-mass conversion to mg/m³ requires ambient temperature and atmospheric pressure metadata not provided in this feed. Direct comparison is unsupported to prevent unverified evaluation.",
                    advisories=[],
                )
            elif norm_unit in ("µg/m³", "ug/m3", "µg/m3"):
                threshold_value = 2000.0
                unit_label = "µg/m³"
            elif norm_unit in ("mg/m³", "mg/m3"):
                threshold_value = 2.0
                unit_label = "mg/m³"
            else:
                return RiskAssessmentResponse(
                    location_id=location.id,
                    station_name=location.name,
                    locality=location.locality,
                    sensor_id=selected_sensor.id,
                    parameter=selected_sensor.parameter_name,
                    parameter_display_name=selected_sensor.parameter_display_name,
                    units=selected_sensor.units,
                    calculation_timestamp_utc=now_utc,
                    calculation_timestamp_local=calc_local,
                    window_start_utc=now_utc - timedelta(hours=standard_cfg.averaging_period_hours),
                    window_end_utc=now_utc,
                    window_start_local=to_local_iso(now_utc - timedelta(hours=standard_cfg.averaging_period_hours), location.timezone),
                    window_end_local=calc_local,
                    averaging_period_hours=standard_cfg.averaging_period_hours,
                    averaging_period_label=standard_cfg.averaging_period_label,
                    valid_observations=0,
                    expected_observations=standard_cfg.averaging_period_hours,
                    missing_observations=standard_cfg.averaging_period_hours,
                    excluded_observations=0,
                    completeness_percentage=0.0,
                    is_completeness_satisfied=False,
                    data_quality_warnings=[f"Unrecognized unit '{selected_sensor.units}' for CO."],
                    calculated_average=None,
                    sensor_datetime_last_utc=selected_sensor.datetime_last_utc,
                    sensor_datetime_last_local=selected_sensor.datetime_last_local,
                    freshness_state=FreshnessState.UNAVAILABLE,
                    freshness_message=f"Unrecognized unit '{selected_sensor.units}'.",
                    status=AssessmentStatus.UNSUPPORTED_PARAMETER,
                    status_label="Unsupported parameter unit",
                    ratio_to_standard=None,
                    screening_limitations=f"Unrecognized unit '{selected_sensor.units}' for carbon monoxide. CPCB standards require mg/m³ or µg/m³.",
                    advisories=[],
                )

        # Step 4: Window Definition
        averaging_hours = standard_cfg.averaging_period_hours
        window_end_utc = now_utc
        window_start_utc = window_end_utc - timedelta(hours=averaging_hours)
        w_start_local = to_local_iso(window_start_utc, location.timezone)
        w_end_local = to_local_iso(window_end_utc, location.timezone)

        # Step 5: Derive sensor-level timestamp and freshness
        sensor_dt_last_utc = selected_sensor.datetime_last_utc
        sensor_dt_last_local = selected_sensor.datetime_last_local

        if sensor_dt_last_utc is None:
            sensor_meta = await self.get_sensor_detail(selected_sensor.id)
            if sensor_meta:
                dt_last_obj = sensor_meta.get("datetimeLast")
                if dt_last_obj and isinstance(dt_last_obj, dict):
                    last_utc_str = dt_last_obj.get("utc")
                    last_local_str = dt_last_obj.get("local")
                    if last_utc_str:
                        try:
                            sensor_dt_last_utc = datetime.fromisoformat(last_utc_str.replace("Z", "+00:00"))
                            sensor_dt_last_local = last_local_str or to_local_iso(sensor_dt_last_utc, location.timezone)
                            selected_sensor.datetime_last_utc = sensor_dt_last_utc
                            selected_sensor.datetime_last_local = sensor_dt_last_local
                        except Exception:
                            pass

        if sensor_dt_last_utc and not sensor_dt_last_local:
            sensor_dt_last_local = to_local_iso(sensor_dt_last_utc, location.timezone)

        # Freshness evaluation
        if sensor_dt_last_utc is None:
            freshness_state = FreshnessState.UNAVAILABLE
            freshness_msg = f"No observation history available for {selected_sensor.parameter_display_name} sensor."
        else:
            diff = now_utc - sensor_dt_last_utc
            if diff > timedelta(days=30):
                freshness_state = FreshnessState.HISTORICAL
                freshness_msg = f"Last observation was recorded on {sensor_dt_last_utc.strftime('%Y-%m-%d')} ({diff.days} days ago). Telemetry has ceased."
            elif diff > timedelta(hours=settings.STALE_DATA_THRESHOLD_HOURS):
                freshness_state = FreshnessState.STALE
                days = diff.days
                hours = int((diff.seconds % 86400) // 3600)
                freshness_msg = f"Last observation was recorded {days}d {hours}h ago (threshold is {settings.STALE_DATA_THRESHOLD_HOURS}h)."
            else:
                freshness_state = FreshnessState.FRESH
                freshness_msg = "Sensor observations are current (updated within the last 24 hours)."

        # Step 6: Query upstream observation measurements for the window
        params: Dict[str, Any] = {
            "datetime_from": window_start_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "datetime_to": window_end_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "limit": 1000,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/sensors/{selected_sensor.id}/hours",
                    params=params,
                    headers=self._get_headers(),
                )
                if response.status_code == 404:
                    raw_resp = await client.get(
                        f"{self.base_url}/sensors/{selected_sensor.id}/measurements",
                        params=params,
                        headers=self._get_headers(),
                    )
                    if raw_resp.is_success:
                        response = raw_resp
        except httpx.TimeoutException:
            raise OpenAQServiceError(
                message=f"Timeout retrieving observations for sensor {selected_sensor.id}.",
                status_code=504,
                error_code="UPSTREAM_TIMEOUT",
            )
        except httpx.RequestError as exc:
            raise OpenAQServiceError(
                message=f"Network error contacting OpenAQ: {str(exc)}",
                status_code=502,
                error_code="NETWORK_ERROR",
            )

        if not response.is_success:
            self._handle_response_error(response)

        results_data = response.json().get("results", [])

        # Step 7: Parse, deduplicate by window identity, and exclude invalid negatives
        deduped_points: Dict[datetime, MeasurementPoint] = {}
        detected_interval_seconds: Optional[int] = None
        excluded_negatives = 0
        data_quality_warnings: List[str] = []

        for row in results_data:
            val = row.get("value")
            if val is None:
                continue

            period_data = row.get("period") or {}
            period_label = period_data.get("label", "hour")
            interval_str = period_data.get("interval")

            dt_from_data = period_data.get("datetimeFrom") or {}
            dt_to_data = period_data.get("datetimeTo") or {}

            utc_from_str = dt_from_data.get("utc")
            utc_to_str = dt_to_data.get("utc")

            if not utc_from_str or not utc_to_str:
                continue

            try:
                pt_from_utc = datetime.fromisoformat(utc_from_str.replace("Z", "+00:00"))
                pt_to_utc = datetime.fromisoformat(utc_to_str.replace("Z", "+00:00"))
            except Exception:
                continue

            # Update latest observation timestamp if this point is newer
            if sensor_dt_last_utc is None or pt_to_utc > sensor_dt_last_utc:
                sensor_dt_last_utc = pt_to_utc
                sensor_dt_last_local = dt_to_data.get("local") or to_local_iso(pt_to_utc, location.timezone)
                diff = now_utc - sensor_dt_last_utc
                if diff > timedelta(days=30):
                    freshness_state = FreshnessState.HISTORICAL
                    freshness_msg = f"Last observation was recorded on {sensor_dt_last_utc.strftime('%Y-%m-%d')} ({diff.days} days ago). Telemetry has ceased."
                elif diff > timedelta(hours=settings.STALE_DATA_THRESHOLD_HOURS):
                    freshness_state = FreshnessState.STALE
                    days = diff.days
                    hours = int((diff.seconds % 86400) // 3600)
                    freshness_msg = f"Last observation was recorded {days}d {hours}h ago."
                else:
                    freshness_state = FreshnessState.FRESH
                    freshness_msg = "Sensor observations are current (updated within the last 24 hours)."

            # Check invalid negative values
            float_val = float(val)
            if float_val < 0.0:
                excluded_negatives += 1
                continue

            pt_interval_sec = parse_sampling_interval_seconds(interval_str, period_label)
            if detected_interval_seconds is None and pt_interval_sec > 0:
                detected_interval_seconds = pt_interval_sec

            coverage_data = row.get("coverage") or {}
            pct_complete = coverage_data.get("percentComplete")

            local_from = dt_from_data.get("local") or to_local_iso(pt_from_utc, location.timezone)
            local_to = dt_to_data.get("local") or to_local_iso(pt_to_utc, location.timezone)

            pt = MeasurementPoint(
                value=round(float_val, 2),
                parameter=selected_sensor.parameter_name,
                units=selected_sensor.units,
                period_label=period_label,
                interval=interval_str,
                datetime_from_utc=pt_from_utc,
                datetime_to_utc=pt_to_utc,
                datetime_from_local=local_from,
                datetime_to_local=local_to,
                is_missing=False,
                percent_complete=float(pct_complete) if pct_complete is not None else None,
            )

            if pt_from_utc not in deduped_points:
                deduped_points[pt_from_utc] = pt
            else:
                existing = deduped_points[pt_from_utc]
                if (pt.percent_complete or 0) > (existing.percent_complete or 0):
                    deduped_points[pt_from_utc] = pt

        if excluded_negatives > 0:
            data_quality_warnings.append(
                f"Excluded {excluded_negatives} invalid negative concentration measurement(s) (< 0 {unit_label}) from calculation."
            )

        valid_points = sorted(deduped_points.values(), key=lambda p: p.datetime_from_utc)

        # Step 8: Calculate Completeness & Gate
        sampling_seconds = detected_interval_seconds or 3600
        total_window_seconds = (window_end_utc - window_start_utc).total_seconds()
        expected_obs = max(int(total_window_seconds // sampling_seconds), 1)
        valid_obs = len(valid_points)
        missing_obs = max(0, expected_obs - valid_obs)
        completeness_pct = round((valid_obs / expected_obs) * 100, 1)

        # EcoSentinel 75% quality rule
        required_obs = math.ceil(0.75 * expected_obs)
        is_completeness_satisfied = (valid_obs >= required_obs) and (completeness_pct >= 75.0)

        # Secondary benchmark setup
        sec_name = standard_cfg.who_guideline.name if standard_cfg.who_guideline else None
        sec_thresh = standard_cfg.who_guideline.threshold if standard_cfg.who_guideline else None
        sec_unit = standard_cfg.who_guideline.unit if standard_cfg.who_guideline else None
        sec_url = standard_cfg.who_guideline.source_url if standard_cfg.who_guideline else None
        sec_notes = standard_cfg.who_guideline.notes if standard_cfg.who_guideline else None
        if target_param == "co":
            sec_name = "WHO AQG (2021)"
            sec_thresh = None
            sec_unit = "mg/m³"
            sec_url = WHO_AQG_URL
            sec_notes = "WHO 2021 CO guideline (4.0 mg/m³) prescribes a 24-hour averaging period and cannot be compared to an 8-hour window."

        # Step 9: Decision Logic and Screening Status
        if freshness_state == FreshnessState.HISTORICAL:
            status = AssessmentStatus.HISTORICAL_DATA
            status_label = "Historical data"
            calculated_avg = None
            ratio_to_std = None
            advisories = []
            screening_limitations = (
                f"Sensor telemetry ceased > 30 days ago (last observation recorded on "
                f"{sensor_dt_last_utc.strftime('%Y-%m-%d') if sensor_dt_last_utc else 'unknown'}). "
                f"Real-time operational risk screening and mitigation advisories are strictly suppressed for historical datasets."
            )
        elif freshness_state == FreshnessState.STALE:
            status = AssessmentStatus.STALE_DATA
            status_label = "Stale data"
            calculated_avg = None
            ratio_to_std = None
            advisories = []
            screening_limitations = (
                f"Sensor observations have not updated within the past 24 hours. "
                f"Real-time operational risk screening and mitigation advisories are suppressed to prevent acting on outdated evidence."
            )
        elif freshness_state == FreshnessState.UNAVAILABLE:
            status = AssessmentStatus.UNAVAILABLE
            status_label = "Unavailable"
            calculated_avg = None
            ratio_to_std = None
            advisories = []
            screening_limitations = "No observation data available from upstream sensor for the requested evaluation window."
        elif not is_completeness_satisfied:
            status = AssessmentStatus.INSUFFICIENT_DATA
            status_label = "Insufficient data"
            calculated_avg = None
            ratio_to_std = None
            advisories = []
            screening_limitations = (
                f"Evaluation window contains {valid_obs}/{expected_obs} hourly observations ({completeness_pct}% coverage). "
                f"EcoSentinel requires at least 75% coverage ({required_obs}/{expected_obs} observations in {averaging_hours}h) "
                f"to compute a statistically valid rolling average. Real-time advisories are suppressed."
            )
        else:
            calculated_avg = round(sum(p.value for p in valid_points) / len(valid_points), 2)
            ratio_to_std = round(calculated_avg / threshold_value, 2)

            if calculated_avg > threshold_value:
                status = AssessmentStatus.ABOVE_REFERENCE
                status_label = "Above reference level"
                screening_limitations = (
                    f"Calculated {averaging_hours}-hour rolling average ({calculated_avg} {unit_label}) "
                    f"exceeds the CPCB NAAQS reference level of {threshold_value} {unit_label} ({ratio_to_std}x reference level). "
                    f"Based on {valid_obs}/{expected_obs} valid hourly observations ({completeness_pct}% completeness)."
                )
                template_advisories = REVIEWED_ADVISORIES.get(target_param, [])
                advisories = [
                    MitigationAdvisory(
                        category=tmpl.category,
                        action=tmpl.action,
                        rationale=tmpl.rationale,
                        uncertainty=tmpl.uncertainty,
                    )
                    for tmpl in template_advisories
                ]
            else:
                status = AssessmentStatus.BELOW_REFERENCE
                status_label = "Below reference level"
                screening_limitations = (
                    f"Calculated {averaging_hours}-hour rolling average ({calculated_avg} {unit_label}) "
                    f"is within the CPCB NAAQS reference level of {threshold_value} {unit_label} ({ratio_to_std}x reference level). "
                    f"Based on {valid_obs}/{expected_obs} valid hourly observations ({completeness_pct}% completeness)."
                )
                advisories = []

        return RiskAssessmentResponse(
            location_id=location.id,
            station_name=location.name,
            locality=location.locality,
            sensor_id=selected_sensor.id,
            parameter=selected_sensor.parameter_name,
            parameter_display_name=selected_sensor.parameter_display_name,
            units=unit_label,
            calculation_timestamp_utc=now_utc,
            calculation_timestamp_local=calc_local,
            window_start_utc=window_start_utc,
            window_end_utc=window_end_utc,
            window_start_local=w_start_local,
            window_end_local=w_end_local,
            averaging_period_hours=averaging_hours,
            averaging_period_label=standard_cfg.averaging_period_label,
            valid_observations=valid_obs,
            expected_observations=expected_obs,
            missing_observations=missing_obs,
            excluded_observations=excluded_negatives,
            completeness_percentage=completeness_pct,
            is_completeness_satisfied=is_completeness_satisfied,
            data_quality_warnings=data_quality_warnings,
            calculated_average=calculated_avg,
            sensor_datetime_last_utc=sensor_dt_last_utc,
            sensor_datetime_last_local=sensor_dt_last_local,
            freshness_state=freshness_state,
            freshness_message=freshness_msg,
            standard_name=standard_cfg.cpcb_standard.name,
            standard_threshold=threshold_value,
            standard_unit=unit_label,
            standard_url=standard_cfg.cpcb_standard.source_url,
            secondary_benchmark_name=sec_name,
            secondary_benchmark_threshold=sec_thresh,
            secondary_benchmark_unit=sec_unit,
            secondary_benchmark_url=sec_url,
            secondary_benchmark_notes=sec_notes,
            status=status,
            status_label=status_label,
            ratio_to_standard=ratio_to_std,
            screening_limitations=screening_limitations,
            advisories=advisories,
        )


openaq_service = OpenAQClient()
