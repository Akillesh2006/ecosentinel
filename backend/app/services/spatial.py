"""Spatial analysis service orchestrating neighbor discovery and multi-station comparison.

EcoSentinel Milestone 7 Phase A.
"""

import asyncio
import logging
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings
from app.core.spatial import (
    haversine_distance_km,
    is_valid_coordinate,
    calculate_neighborhood_median,
    calculate_neighborhood_iqr,
    calculate_pairwise_pearson_correlation,
)
from app.schemas.air_quality import Coordinates, LocationDetail
from app.schemas.spatial import (
    ComparisonTimeSlice,
    NeighborStationSummary,
    SpatialComparisonRequest,
    SpatialComparisonResponse,
    SpatialNeighborsResponse,
    StationComparisonMetadata,
    StationPartialFailure,
)
from app.services.openaq import (
    OpenAQMissingKeyError,
    OpenAQServiceError,
    openaq_service,
    to_local_iso,
)

logger = logging.getLogger(__name__)


class SpatialService:
    """Service providing spatial neighbor discovery and multi-station comparison."""

    def __init__(self, openaq=openaq_service):
        self.openaq = openaq

    async def discover_neighbors(
        self,
        reference_location_id: int,
        parameter: str,
        radius_km: float = 25.0,
        limit: int = 20,
    ) -> SpatialNeighborsResponse:
        """Finds eligible monitoring stations within a geographic radius that monitor the requested pollutant.

        Guarantees:
            - Validates radius between 1.0 km and 100.0 km.
            - Excludes reference station from neighbor list.
            - Filters out stations lacking valid WGS-84 coordinates.
            - Filters out stations lacking sensors for the target pollutant.
            - Returns exact Haversine distance, sorted ascending.
            - Reports diagnostic exclusion counts for complete auditability.
        """
        if not self.openaq.is_configured():
            raise OpenAQMissingKeyError()

        if radius_km < 1.0 or radius_km > 100.0:
            raise OpenAQServiceError(
                message=f"Search radius must be between 1.0 km and 100.0 km (received {radius_km} km).",
                status_code=400,
                error_code="INVALID_RADIUS",
                instructions="Provide a search radius between 1.0 and 100.0 km.",
            )

        clamped_limit = min(max(limit, 1), 50)
        norm_param = parameter.strip().lower()
        if not norm_param:
            raise OpenAQServiceError(
                message="Target pollutant parameter must not be empty.",
                status_code=400,
                error_code="INVALID_PARAMETER",
            )

        # 1. Retrieve reference station metadata
        ref_detail = await self.openaq.get_location_detail(reference_location_id)
        if not ref_detail.coordinates or not is_valid_coordinate(
            ref_detail.coordinates.latitude, ref_detail.coordinates.longitude
        ):
            raise OpenAQServiceError(
                message=f"Reference station '{ref_detail.name}' (ID: {reference_location_id}) has no valid coordinates registered.",
                status_code=422,
                error_code="REFERENCE_COORDINATES_MISSING",
                instructions="Select a reference station with verified geographical coordinates for spatial analysis.",
            )

        # Verify reference station monitors the requested pollutant
        ref_params = [p.lower() for p in ref_detail.available_parameters]
        if norm_param not in ref_params:
            valid_p = ", ".join(ref_detail.available_parameters)
            raise OpenAQServiceError(
                message=f"Pollutant '{parameter}' is not monitored at reference station '{ref_detail.name}'. Available: {valid_p}",
                status_code=400,
                error_code="REFERENCE_POLLUTANT_UNAVAILABLE",
                instructions=f"Select one of the monitored parameters: {valid_p}",
            )

        param_display_name = norm_param.upper()
        for sensor in ref_detail.sensors:
            if sensor.parameter_name.lower() == norm_param:
                param_display_name = sensor.parameter_display_name
                break

        ref_lat = ref_detail.coordinates.latitude
        ref_lon = ref_detail.coordinates.longitude

        # 2. Query candidate locations around reference coordinates from OpenAQ
        radius_meters = int(radius_km * 1000)
        query_params = {
            "coordinates": f"{ref_lat},{ref_lon}",
            "radius": radius_meters,
            "limit": 100,
            "order_by": "id",
            "sort_order": "desc",
        }

        raw_candidates: List[dict] = []
        try:
            async with httpx.AsyncClient(timeout=self.openaq.timeout) as client:
                response = await client.get(
                    f"{self.openaq.base_url}/locations",
                    params=query_params,
                    headers=self.openaq._get_headers(),
                )

                if response.is_success:
                    data = response.json()
                    raw_candidates.extend(data.get("results", []))
                else:
                    self.openaq._handle_response_error(response)
        except httpx.TimeoutException:
            raise OpenAQServiceError(
                message="Timeout searching for nearby monitoring stations.",
                status_code=504,
                error_code="UPSTREAM_TIMEOUT",
            )
        except httpx.RequestError as exc:
            raise OpenAQServiceError(
                message=f"Network error searching for nearby monitoring stations: {str(exc)}",
                status_code=502,
                error_code="NETWORK_ERROR",
            )

        # 3. Filter candidates and compute spatial metrics
        now_utc = datetime.now(timezone.utc)
        stale_delta = timedelta(hours=settings.STALE_DATA_THRESHOLD_HOURS)

        candidates_examined = 0
        missing_coordinates_count = 0
        pollutant_incompatible_count = 0
        outside_radius_count = 0
        self_excluded_count = 0
        eligible_neighbors: List[NeighborStationSummary] = []

        for item in raw_candidates:
            if not isinstance(item, dict):
                continue

            candidates_examined += 1
            cid = item.get("id")
            if cid == reference_location_id:
                self_excluded_count += 1
                continue

            coords_data = item.get("coordinates")
            if not coords_data or not isinstance(coords_data, dict):
                missing_coordinates_count += 1
                continue

            raw_lat = coords_data.get("latitude")
            raw_lon = coords_data.get("longitude")
            if not is_valid_coordinate(raw_lat, raw_lon):
                missing_coordinates_count += 1
                continue

            cand_lat = float(raw_lat)
            cand_lon = float(raw_lon)

            # Check pollutant availability
            sensors_list = item.get("sensors") or []
            cand_params: List[str] = []
            cand_sensor_id: Optional[int] = None
            for s in sensors_list:
                p_data = s.get("parameter") or {}
                p_name = p_data.get("name", "")
                if p_name and p_name.lower() not in cand_params:
                    cand_params.append(p_name.lower())
                if p_name.lower() == norm_param and cand_sensor_id is None:
                    cand_sensor_id = s.get("id")

            if norm_param not in cand_params:
                pollutant_incompatible_count += 1
                continue

            # Calculate spherical great-circle distance using Haversine formula (Earth mean radius 6371.0088 km)
            dist_km = haversine_distance_km(ref_lat, ref_lon, cand_lat, cand_lon)
            if dist_km > radius_km:
                outside_radius_count += 1
                continue

            # Parse datetimeLast
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
                            dt_last_local = to_local_iso(dt_last_utc, item.get("timezone") or "Asia/Kolkata")
                        if now_utc - dt_last_utc > stale_delta:
                            is_stale = True
                    except Exception:
                        pass

            provider_data = item.get("provider") or {}
            owner_data = item.get("owner") or {}

            eligible_neighbors.append(
                NeighborStationSummary(
                    id=cid,
                    name=item.get("name") or f"Station {cid}",
                    locality=item.get("locality"),
                    country_code=item.get("country", {}).get("code", "IN") if isinstance(item.get("country"), dict) else "IN",
                    provider_name=provider_data.get("name") or "Unknown Provider",
                    owner_name=owner_data.get("name"),
                    coordinates=Coordinates(latitude=cand_lat, longitude=cand_lon),
                    distance_km=round(dist_km, 2),
                    available_parameters=cand_params,
                    sensor_id=cand_sensor_id,
                    datetime_last_utc=dt_last_utc,
                    datetime_last_local=dt_last_local,
                    is_stale=is_stale,
                )
            )

        # Sort eligible neighbors by distance ascending
        eligible_neighbors.sort(key=lambda n: n.distance_km)
        returned_neighbors = eligible_neighbors[:clamped_limit]

        return SpatialNeighborsResponse(
            reference_station_id=ref_detail.id,
            reference_station_name=ref_detail.name,
            reference_coordinates=ref_detail.coordinates,
            reference_provider_name=ref_detail.provider_name,
            reference_owner_name=ref_detail.owner_name,
            parameter=norm_param,
            parameter_display_name=param_display_name,
            radius_km=round(radius_km, 1),
            candidates_examined_count=candidates_examined,
            eligible_neighbors_count=len(returned_neighbors),
            missing_coordinates_count=missing_coordinates_count,
            pollutant_incompatible_count=pollutant_incompatible_count,
            outside_radius_count=outside_radius_count,
            self_excluded_count=self_excluded_count,
            neighbors=returned_neighbors,
        )

    async def compare_stations(
        self,
        request: SpatialComparisonRequest,
    ) -> SpatialComparisonResponse:
        """Performs multi-station time-series synchronization, coverage calculation, and spatial correlation.

        Guarantees:
            - Validates total unique stations between 2 and 5.
            - Rejects duplicate IDs and reference station self-comparison.
            - Verifies that all participating stations monitor the requested pollutant.
            - Preserves exact hourly timestamps and represents missing observations as null (never zero).
            - Calculates coincident coverage and pairwise Pearson correlation with safeguards.
            - Identifies partial station failures without silently dropping stations.
        """
        if not self.openaq.is_configured():
            raise OpenAQMissingKeyError()

        ref_id = request.reference_location_id
        neighbor_ids = request.neighbor_location_ids
        norm_param = request.parameter.strip().lower()

        all_requested_ids = [ref_id] + neighbor_ids
        total_requested = len(all_requested_ids)

        # Time range validation
        now_utc = datetime.now(timezone.utc)
        date_to = request.date_to or now_utc
        if date_to.tzinfo is None:
            date_to = date_to.replace(tzinfo=timezone.utc)

        date_from = request.date_from or (date_to - timedelta(hours=24))
        if date_from.tzinfo is None:
            date_from = date_from.replace(tzinfo=timezone.utc)

        if date_from >= date_to:
            raise OpenAQServiceError(
                message="date_from must be earlier than date_to.",
                status_code=400,
                error_code="INVALID_DATE_RANGE",
            )

        if (date_to - date_from).total_seconds() > 90 * 86400:
            raise OpenAQServiceError(
                message="Requested time range exceeds the 90-day maximum limit.",
                status_code=400,
                error_code="EXCESSIVE_TIME_RANGE",
            )

        # Step 1: Concurrently fetch metadata for all requested stations
        loc_tasks = [self.openaq.get_location_detail(sid) for sid in all_requested_ids]
        loc_results = await asyncio.gather(*loc_tasks, return_exceptions=True)

        station_details: Dict[int, LocationDetail] = {}
        partial_failures: List[StationPartialFailure] = []

        for sid, res in zip(all_requested_ids, loc_results):
            if isinstance(res, Exception):
                msg = str(res)
                if sid == ref_id:
                    status_code = getattr(res, "status_code", 404)
                    error_code = getattr(res, "error_code", "REFERENCE_STATION_NOT_FOUND")
                    raise OpenAQServiceError(
                        message=f"Reference station {sid} could not be retrieved: {msg}",
                        status_code=status_code,
                        error_code=error_code,
                    )
                partial_failures.append(
                    StationPartialFailure(
                        location_id=sid,
                        error_code=getattr(res, "error_code", "STATION_NOT_FOUND"),
                        message=msg,
                    )
                )
            else:
                cand_params = [p.lower() for p in res.available_parameters]
                if norm_param not in cand_params:
                    if sid == ref_id:
                        valid_p = ", ".join(res.available_parameters)
                        raise OpenAQServiceError(
                            message=f"Reference station '{res.name}' does not monitor '{norm_param}'. Available: {valid_p}",
                            status_code=400,
                            error_code="REFERENCE_POLLUTANT_UNAVAILABLE",
                        )
                    partial_failures.append(
                        StationPartialFailure(
                            location_id=sid,
                            error_code="POLLUTANT_UNAVAILABLE",
                            message=f"Station '{res.name}' (ID: {sid}) does not monitor '{norm_param}'.",
                        )
                    )
                else:
                    station_details[sid] = res

        if len(station_details) < 2:
            raise OpenAQServiceError(
                message=f"Insufficient valid stations available for spatial comparison (minimum 2 required; only {len(station_details)} valid).",
                status_code=400,
                error_code="INSUFFICIENT_VALID_STATIONS",
                instructions="Ensure at least two stations monitor the requested pollutant.",
            )

        # Step 2: Concurrently fetch measurements for all valid stations
        valid_station_ids = [sid for sid in all_requested_ids if sid in station_details]
        meas_tasks = [
            self.openaq.get_measurements(
                location_id=sid,
                parameter=norm_param,
                date_from=date_from,
                date_to=date_to,
            )
            for sid in valid_station_ids
        ]
        meas_results = await asyncio.gather(*meas_tasks, return_exceptions=True)

        station_measurements: Dict[int, Any] = {}
        for sid, res in zip(valid_station_ids, meas_results):
            if isinstance(res, Exception):
                msg = str(res)
                if sid == ref_id:
                    status_code = getattr(res, "status_code", 502)
                    error_code = getattr(res, "error_code", "MEASUREMENT_RETRIEVAL_FAILED")
                    raise OpenAQServiceError(
                        message=f"Failed to retrieve measurements for reference station {sid}: {msg}",
                        status_code=status_code,
                        error_code=error_code,
                    )
                partial_failures.append(
                    StationPartialFailure(
                        location_id=sid,
                        error_code=getattr(res, "error_code", "MEASUREMENT_RETRIEVAL_FAILED"),
                        message=msg,
                    )
                )
            else:
                station_measurements[sid] = res

        if len(station_measurements) < 2:
            raise OpenAQServiceError(
                message=f"Insufficient stations with available measurements for comparison (minimum 2 required; only {len(station_measurements)} succeeded).",
                status_code=400,
                error_code="INSUFFICIENT_VALID_STATIONS",
            )

        # Step 3: Enforce compatible measurement units across stations
        ref_meas = station_measurements[ref_id]
        ref_units = ref_meas.units.strip()

        final_participating_ids: List[int] = [ref_id]
        for sid in valid_station_ids:
            if sid == ref_id:
                continue
            if sid not in station_measurements:
                continue
            meas = station_measurements[sid]
            if meas.units.strip().lower() != ref_units.lower():
                partial_failures.append(
                    StationPartialFailure(
                        location_id=sid,
                        error_code="UNIT_MISMATCH",
                        message=f"Station '{station_details[sid].name}' uses unit '{meas.units}', which does not match reference unit '{ref_units}'.",
                    )
                )
            else:
                final_participating_ids.append(sid)

        if len(final_participating_ids) < 2:
            raise OpenAQServiceError(
                message=f"Insufficient stations with compatible measurement units (minimum 2 required).",
                status_code=400,
                error_code="INSUFFICIENT_VALID_STATIONS",
            )

        # Step 4: Build unified chronological hourly time grid derived consistently from requested time window
        # Points indexed by start timestamp (datetime_from_utc)
        points_by_station: Dict[int, Dict[datetime, Any]] = {}
        all_timestamps_set = set()

        for sid in final_participating_ids:
            pts = station_measurements[sid].measurements
            p_dict = {p.datetime_from_utc: p for p in pts}
            points_by_station[sid] = p_dict
            all_timestamps_set.update(p_dict.keys())

        # If any observations exist, determine anchor minute/second to derive expected hourly grid
        effective_to = min(date_to, now_utc)
        if all_timestamps_set and effective_to > date_from:
            sorted_observed = sorted(list(all_timestamps_set))
            anchor_min = sorted_observed[0].minute
            anchor_sec = sorted_observed[0].second

            # Generate expected hourly intervals from date_from to effective_to aligned to anchor
            cur_ts = date_from.replace(minute=anchor_min, second=anchor_sec, microsecond=0)
            if cur_ts < date_from:
                cur_ts += timedelta(hours=1)
            while cur_ts < effective_to:
                all_timestamps_set.add(cur_ts)
                cur_ts += timedelta(hours=1)

        sorted_timestamps = sorted(list(all_timestamps_set))
        time_slices: List[ComparisonTimeSlice] = []
        all_stations_coincident_count = 0

        for ts in sorted_timestamps:
            slice_values: Dict[int, Optional[float]] = {}
            contributing_vals: List[float] = []
            local_ts_str: Optional[str] = None

            for sid in final_participating_ids:
                pt = points_by_station[sid].get(ts)
                if pt is not None and pt.value is not None:
                    slice_values[sid] = pt.value
                    contributing_vals.append(pt.value)
                    if local_ts_str is None and pt.datetime_from_local:
                        local_ts_str = pt.datetime_from_local
                else:
                    slice_values[sid] = None

            if local_ts_str is None:
                local_ts_str = to_local_iso(ts, station_details[ref_id].timezone or "Asia/Kolkata")

            if len(contributing_vals) == len(final_participating_ids):
                all_stations_coincident_count += 1

            med = calculate_neighborhood_median(contributing_vals)
            iqr = calculate_neighborhood_iqr(contributing_vals)
            min_val = round(min(contributing_vals), 2) if len(contributing_vals) >= 2 else None
            max_val = round(max(contributing_vals), 2) if len(contributing_vals) >= 2 else None

            time_slices.append(
                ComparisonTimeSlice(
                    datetime_utc=ts,
                    datetime_local=local_ts_str,
                    station_values=slice_values,
                    contributing_stations=len(contributing_vals),
                    neighborhood_median=med,
                    neighborhood_min=min_val,
                    neighborhood_max=max_val,
                    neighborhood_iqr=iqr,
                )
            )

        # Step 5: Station-level metadata, distance, coverage, and pairwise correlation
        ref_loc = station_details[ref_id]
        if effective_to <= date_from:
            expected_obs = 0
        else:
            elapsed_seconds = (effective_to - date_from).total_seconds()
            expected_obs = max(int(elapsed_seconds // 3600), 1)

        ref_valid_obs = ref_meas.total_observations

        station_metas: List[StationComparisonMetadata] = []
        ref_series = [
            points_by_station[ref_id].get(ts).value if points_by_station[ref_id].get(ts) else None
            for ts in sorted_timestamps
        ]

        for sid in final_participating_ids:
            loc = station_details[sid]
            meas = station_measurements[sid]
            is_ref = sid == ref_id

            dist_km: Optional[float] = None
            if is_ref:
                dist_km = 0.0
            else:
                if (
                    ref_loc.coordinates
                    and loc.coordinates
                    and is_valid_coordinate(ref_loc.coordinates.latitude, ref_loc.coordinates.longitude)
                    and is_valid_coordinate(loc.coordinates.latitude, loc.coordinates.longitude)
                ):
                    dist_km = round(
                        haversine_distance_km(
                            ref_loc.coordinates.latitude,
                            ref_loc.coordinates.longitude,
                            loc.coordinates.latitude,
                            loc.coordinates.longitude,
                        ),
                        2,
                    )

            this_series = [
                points_by_station[sid].get(ts).value if points_by_station[sid].get(ts) else None
                for ts in sorted_timestamps
            ]

            coincident_with_ref = sum(
                1 for r, t in zip(ref_series, this_series) if r is not None and t is not None
            )

            # 1. Station coverage: valid observations / expected observations * 100
            cov_pct = (
                round((meas.total_observations / expected_obs) * 100, 1) if expected_obs > 0 else None
            )

            # 2. Pairwise overlap coverage: coincident valid hours / expected observations * 100
            pairwise_overlap_pct = (
                round((coincident_with_ref / expected_obs) * 100, 1) if expected_obs > 0 else None
            )

            # 3. Conditional reference coverage: coincident valid hours / valid reference observations * 100
            conditional_ref_pct = (
                round((coincident_with_ref / ref_valid_obs) * 100, 1) if ref_valid_obs > 0 else None
            )

            if is_ref:
                corr = 1.0
                corr_status = "REFERENCE_STATION"
            else:
                corr, corr_status = calculate_pairwise_pearson_correlation(
                    ref_series, this_series, min_coincident=6
                )

            station_metas.append(
                StationComparisonMetadata(
                    location_id=sid,
                    station_name=loc.name,
                    locality=loc.locality,
                    provider_name=loc.provider_name,
                    owner_name=loc.owner_name,
                    is_reference=is_ref,
                    distance_from_reference_km=dist_km,
                    coordinates=loc.coordinates,
                    sensor_id=meas.sensor_id,
                    units=meas.units,
                    total_valid_observations=meas.total_observations,
                    expected_observations=expected_obs,
                    station_coverage_percentage=cov_pct,
                    coverage_percentage=cov_pct,
                    coincident_with_reference_hours=coincident_with_ref,
                    pairwise_overlap_coverage_percentage=pairwise_overlap_pct,
                    coincident_coverage_percentage=pairwise_overlap_pct,
                    conditional_reference_coverage_percentage=conditional_ref_pct,
                    min_correlation_samples_threshold=6,
                    pearson_correlation_with_reference=corr,
                    correlation_status=corr_status,
                    is_stale=meas.is_stale,
                    sensor_datetime_last_utc=meas.sensor_datetime_last_utc,
                    sensor_datetime_last_local=meas.sensor_datetime_last_local,
                )
            )

        # Step 6: Global metrics and mixed-provider detection
        # 4. All-stations coincident coverage: all-stations coincident hours / expected observations * 100
        all_coincident_pct = (
            round((all_stations_coincident_count / expected_obs) * 100, 1) if expected_obs > 0 else None
        )
        providers = set(s.provider_name for s in station_metas if s.provider_name)
        owners = set(s.owner_name for s in station_metas if s.owner_name)
        is_mixed_providers = len(providers) > 1 or len(owners) > 1

        data_quality_warnings: List[str] = []
        if is_mixed_providers:
            data_quality_warnings.append(
                "Comparison includes stations from different managing providers or owners. Interpret differences with consideration for instrumentation and micro-siting variations."
            )
        if all_coincident_pct is not None and all_coincident_pct < 75.0:
            data_quality_warnings.append(
                f"Concurrent observation coverage across all stations is {all_coincident_pct}%, which is below the 75% completeness benchmark."
            )
        if partial_failures:
            data_quality_warnings.append(
                f"{len(partial_failures)} requested station(s) could not be included in the comparison."
            )

        return SpatialComparisonResponse(
            parameter=norm_param,
            parameter_display_name=ref_meas.parameter_display_name,
            units=ref_units,
            requested_from_utc=date_from,
            requested_to_utc=date_to,
            reference_station_id=ref_id,
            total_stations_requested=total_requested,
            total_valid_stations=len(final_participating_ids),
            partial_failures=partial_failures,
            all_stations_coincident_hours=all_stations_coincident_count,
            all_stations_coincident_coverage_percentage=all_coincident_pct,
            mixed_providers=is_mixed_providers,
            stations=station_metas,
            time_slices=time_slices,
            data_quality_warnings=data_quality_warnings,
        )


spatial_service = SpatialService()

