import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional
import httpx

from app.core.config import settings
from app.schemas.air_quality import (
    Coordinates,
    LocationDetail,
    LocationMeasurementsResponse,
    LocationSummary,
    MeasurementPoint,
    ProviderStatus,
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
        """Queries OpenAQ v3 locations for a given country ISO code with optional search filtering."""
        if not self.is_configured():
            raise OpenAQMissingKeyError()

        # If search matches a recognized Indian metropolitan area, use coordinates with 25km radius
        city_coords = None
        if search:
            query = search.strip().lower()
            for city_key, coords in INDIAN_CITY_COORDINATES.items():
                if city_key in query:
                    city_coords = coords
                    break

        params: Dict[str, Any] = {
            "limit": min(max(limit, 1), 100),
            "page": max(page, 1),
            "order_by": "id",
            "sort_order": "desc",
        }
        if city_coords:
            params["coordinates"] = f"{city_coords[0]},{city_coords[1]}"
            params["radius"] = 25000
        else:
            params["iso"] = country.upper()

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/locations",
                    params=params,
                    headers=self._get_headers(),
                )
        except httpx.TimeoutException:
            raise OpenAQServiceError(
                message="Request to OpenAQ timed out while searching locations.",
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
        raw_results = data.get("results", [])

        locations: List[LocationSummary] = []
        now_utc = datetime.now(timezone.utc)
        stale_delta = timedelta(hours=settings.STALE_DATA_THRESHOLD_HOURS)

        for item in raw_results:
            loc_id = item.get("id")
            name = item.get("name") or f"Station {loc_id}"
            locality = item.get("locality")

            # Extract coordinates
            coords_data = item.get("coordinates")
            coords = None
            if coords_data and "latitude" in coords_data and "longitude" in coords_data:
                coords = Coordinates(
                    latitude=float(coords_data["latitude"]),
                    longitude=float(coords_data["longitude"]),
                )

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

            # Search filter (case-insensitive substring match on name, locality, provider)
            if search:
                query = search.strip().lower()
                target_str = f"{name} {locality or ''} {provider_name}".lower()
                if query not in target_str:
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

        return locations

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


openaq_service = OpenAQClient()
