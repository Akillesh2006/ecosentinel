"""Core spatial geometry foundation for EcoSentinel.

Provides pure Python spherical distance calculations (Haversine great-circle approximation),
coordinate validation, bounding-box calculations, and robust cross-station statistical aggregations.
"""

import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from app.schemas.spatial import (
    HourlyNeighborhoodScreening,
    HourlyStationExclusion,
    NeighborhoodScreeningSummary,
    SpatialScreeningClassification,
    SpatialScreeningStatus,
    WindowStationExclusion,
)

# Earth mean radius recommended by the International Union of Geodesy and Geophysics (IUGG).
# Volumetric mean radius: R = 6371.0088 km.
# Note: Haversine calculates great-circle distance on a spherical Earth model with this mean radius;
# it is a spherical approximation rather than an exact ellipsoidal geodesic calculation on the WGS-84 ellipsoid.
EARTH_RADIUS_KM: float = 6371.0088


def is_valid_coordinate(latitude: Any, longitude: Any) -> bool:
    """Checks whether latitude and longitude are valid numeric values within geographical limits.

    Valid ranges:
        latitude:  [-90.0, 90.0]
        longitude: [-180.0, 180.0]
    """
    if latitude is None or longitude is None:
        return False
    if not isinstance(latitude, (int, float)) or not isinstance(longitude, (int, float)):
        return False
    if isinstance(latitude, bool) or isinstance(longitude, bool):
        return False
    if math.isnan(latitude) or math.isinf(latitude) or math.isnan(longitude) or math.isinf(longitude):
        return False
    return -90.0 <= float(latitude) <= 90.0 and -180.0 <= float(longitude) <= 180.0


def validate_coordinates(latitude: float, longitude: float) -> None:
    """Validates latitude and longitude, raising ValueError with explicit details if invalid."""
    if not is_valid_coordinate(latitude, longitude):
        raise ValueError(
            f"Invalid coordinates: latitude={latitude}, longitude={longitude}. "
            "Latitude must be between -90.0 and 90.0; longitude must be between -180.0 and 180.0."
        )


def haversine_distance_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:
    """Calculates great-circle distance on a spherical Earth model using the Haversine formula.

    Uses the IUGG volumetric mean radius R = 6371.0088 km.
    Note: This is a spherical great-circle approximation assuming a spherical Earth,
    not an ellipsoidal geodesic calculation (such as Vincenty or Karney algorithms on the WGS-84 ellipsoid).
    Input coordinates are assumed to be referenced to the WGS-84 datum.

    Formula:
        a = sin²(Δφ/2) + cos(φ1) * cos(φ2) * sin²(Δλ/2)
        c = 2 * atan2(√a, √(1-a))
        d = R * c

    Guarantees:
        - Symmetric: d(A, B) == d(B, A)
        - Non-negative: d(A, B) >= 0.0
        - Zero distance for identical points: d(A, A) == 0.0
        - Double precision preserved without intermediate rounding.

    Raises:
        ValueError: If any coordinate is missing, non-numeric, or outside valid ranges.
    """
    validate_coordinates(lat1, lon1)
    validate_coordinates(lat2, lon2)

    # Identical coordinates short-circuit
    if lat1 == lat2 and lon1 == lon2:
        return 0.0

    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    sin_half_phi = math.sin(delta_phi / 2.0)
    sin_half_lambda = math.sin(delta_lambda / 2.0)

    a = sin_half_phi * sin_half_phi + math.cos(phi1) * math.cos(phi2) * sin_half_lambda * sin_half_lambda

    # Clamp 'a' to [0.0, 1.0] to protect against floating-point rounding errors near antipodes
    a = max(0.0, min(1.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    distance = EARTH_RADIUS_KM * c
    return max(0.0, distance)


def is_within_radius(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
    radius_km: float,
) -> bool:
    """Returns True if the distance between two points is less than or equal to radius_km."""
    if radius_km < 0.0:
        raise ValueError(f"Radius cannot be negative: radius_km={radius_km}")
    return haversine_distance_km(lat1, lon1, lat2, lon2) <= radius_km


def calculate_bounding_box(
    latitude: float,
    longitude: float,
    radius_km: float,
) -> Dict[str, Any]:
    """Calculates the minimum and maximum latitude/longitude bounding coordinates for a search circle.

    Handles poles and antimeridian (longitude ±180°) crossings safely.

    Returns:
        Dict with keys:
            - min_latitude: float
            - max_latitude: float
            - min_longitude: float
            - max_longitude: float
            - crosses_antimeridian: bool
            - antimeridian_boxes: Optional[List[Dict[str, float]]] (if crosses_antimeridian is True)
    """
    validate_coordinates(latitude, longitude)
    if radius_km <= 0.0:
        raise ValueError(f"Search radius must be strictly positive: radius_km={radius_km}")

    angular_distance = radius_km / EARTH_RADIUS_KM
    lat_deg_delta = math.degrees(angular_distance)

    min_lat = latitude - lat_deg_delta
    max_lat = latitude + lat_deg_delta

    # Overlaps North Pole
    if max_lat >= 90.0:
        return {
            "min_latitude": max(-90.0, min_lat),
            "max_latitude": 90.0,
            "min_longitude": -180.0,
            "max_longitude": 180.0,
            "crosses_antimeridian": False,
        }

    # Overlaps South Pole
    if min_lat <= -90.0:
        return {
            "min_latitude": -90.0,
            "max_latitude": min(90.0, max_lat),
            "min_longitude": -180.0,
            "max_longitude": 180.0,
            "crosses_antimeridian": False,
        }

    cos_lat = math.cos(math.radians(latitude))
    sin_r = math.sin(angular_distance)

    # Parallel of latitude is completely enclosed by the search radius
    if sin_r >= cos_lat:
        return {
            "min_latitude": min_lat,
            "max_latitude": max_lat,
            "min_longitude": -180.0,
            "max_longitude": 180.0,
            "crosses_antimeridian": False,
        }

    delta_lon_deg = math.degrees(math.asin(sin_r / cos_lat))
    min_lon = longitude - delta_lon_deg
    max_lon = longitude + delta_lon_deg

    # Check for antimeridian crossing
    if min_lon < -180.0 or max_lon > 180.0:
        boxes = []
        if min_lon < -180.0:
            boxes.append({"min_longitude": min_lon + 360.0, "max_longitude": 180.0})
            boxes.append({"min_longitude": -180.0, "max_longitude": max_lon})
        else:
            boxes.append({"min_longitude": min_lon, "max_longitude": 180.0})
            boxes.append({"min_longitude": -180.0, "max_longitude": max_lon - 360.0})

        return {
            "min_latitude": min_lat,
            "max_latitude": max_lat,
            "min_longitude": min_lon,
            "max_longitude": max_lon,
            "crosses_antimeridian": True,
            "antimeridian_boxes": boxes,
        }

    return {
        "min_latitude": min_lat,
        "max_latitude": max_lat,
        "min_longitude": min_lon,
        "max_longitude": max_lon,
        "crosses_antimeridian": False,
    }


def calculate_neighborhood_median(values: List[float]) -> Optional[float]:
    """Calculates the median across contributing station observations for a synchronized time slice.

    Requirements:
        - Requires at least 2 contributing stations (returns None if < 2).
        - Excludes missing values (NaN or None) prior to calculation.
        - Rounds to 2 decimal places for presentation.
    """
    valid = [v for v in values if v is not None and not math.isnan(v) and not math.isinf(v)]
    if len(valid) < 2:
        return None

    valid.sort()
    n = len(valid)
    mid = n // 2
    if n % 2 == 1:
        med = valid[mid]
    else:
        med = (valid[mid - 1] + valid[mid]) / 2.0
    return round(float(med), 2)


def calculate_neighborhood_iqr(values: List[float]) -> Optional[float]:
    """Calculates the interquartile range (IQR = Q3 - Q1) across contributing stations.

    Requirements:
        - Requires at least 2 contributing stations (returns None if < 2).
        - Uses linear interpolation for quartiles.
    """
    valid = [v for v in values if v is not None and not math.isnan(v) and not math.isinf(v)]
    if len(valid) < 2:
        return None

    valid.sort()
    n = len(valid)

    def percentile(p: float) -> float:
        idx = (n - 1) * p
        lower = int(math.floor(idx))
        upper = int(math.ceil(idx))
        weight = idx - lower
        return valid[lower] * (1.0 - weight) + valid[upper] * weight

    q1 = percentile(0.25)
    q3 = percentile(0.75)
    return round(float(q3 - q1), 2)


def calculate_pairwise_pearson_correlation(
    series_a: List[Optional[float]],
    series_b: List[Optional[float]],
    min_coincident: int = 6,
) -> Tuple[Optional[float], str]:
    """Calculates exploratory/descriptive sample Pearson correlation coefficient between two synchronized observation series.

    Safeguards:
        - Requires at least min_coincident valid coincident points (threshold: 6) where both series have observations.
        - Detects constant series (zero variance in either series) and returns (None, "ZERO_VARIANCE_CONSTANT_SERIES").
        - Returns (None, "INSUFFICIENT_COINCIDENT_DATA") if coincident samples < min_coincident.
        - Clamps output to [-1.0, 1.0] and rounds to 3 decimal places for presentation.

    Scientific Safeguard:
        This is an exploratory, descriptive sample statistic across coincident hours. It does not imply
        physical causation, atmospheric transport, or regional airshed representativeness.
    """
    if len(series_a) != len(series_b):
        raise ValueError(
            f"Series length mismatch: len(series_a)={len(series_a)}, len(series_b)={len(series_b)}"
        )

    coincident_a: List[float] = []
    coincident_b: List[float] = []

    for a, b in zip(series_a, series_b):
        if a is not None and b is not None and not math.isnan(a) and not math.isnan(b):
            coincident_a.append(float(a))
            coincident_b.append(float(b))

    n = len(coincident_a)
    if n < min_coincident:
        return None, "INSUFFICIENT_COINCIDENT_DATA"

    mean_a = sum(coincident_a) / n
    mean_b = sum(coincident_b) / n

    diff_a = [x - mean_a for x in coincident_a]
    diff_b = [y - mean_b for y in coincident_b]

    sum_sq_a = sum(da * da for da in diff_a)
    sum_sq_b = sum(db * db for db in diff_b)

    # Check for zero variance / flatline series
    if sum_sq_a <= 1e-12 or sum_sq_b <= 1e-12:
        return None, "ZERO_VARIANCE_CONSTANT_SERIES"

    covariance = sum(da * db for da, db in zip(diff_a, diff_b))
    r = covariance / math.sqrt(sum_sq_a * sum_sq_b)

    # Numerical stability clamp
    r_clamped = max(-1.0, min(1.0, r))
    return round(float(r_clamped), 3), "CALCULATED"


def evaluate_neighborhood_screening(
    reference_station_id: int,
    reference_station_name: str,
    all_neighbor_ids: List[int],
    station_names: Dict[int, str],
    time_slices: List[Any],
    window_preset: Optional[str],
    reference_anomaly_result: Optional[Any],
    neighbor_anomaly_results: Dict[int, Optional[Any]],
    partial_failure_ids: Optional[List[int]] = None,
    unit_mismatch_ids: Optional[List[int]] = None,
    measurements_by_station: Optional[Dict[int, List[Any]]] = None,
) -> Tuple[List[HourlyNeighborhoodScreening], NeighborhoodScreeningSummary]:
    """Evaluates multi-station neighborhood anomaly screening for synchronized hourly observation slices.

    Strictly applies Milestone 6 leave-one-out Modified Z-score semantics and Phase D classification rules:
    - Positive-only elevation: M >= +2.5 (elevated), M >= +3.5 (spike). Negative scores are never elevated.
    - Requires at least 2 comparable neighboring stations (window-eligible + reporting + valid non-zero MAD).
    - Window-level suppression when reference coverage fails (<75%), reference is zero-MAD, no eligible neighbors exist,
      or comparison window is unsupported (e.g. 48h).
    """
    total_window_hours = len(time_slices)
    norm_preset = (window_preset or "").strip().lower()

    # Step 1: Check window preset support
    if norm_preset not in ("24h", "7d", "168h"):
        status = SpatialScreeningStatus.EVALUATION_SUPPRESSED_UNSUPPORTED_WINDOW
        suppression_msg = (
            "Spatial neighborhood anomaly screening is supported for 24-hour and 7-day windows only. "
            "The 48-hour comparison window does not have an approved statistical baseline."
        )
    elif reference_anomaly_result is None or not reference_anomaly_result.is_coverage_satisfied:
        status = SpatialScreeningStatus.EVALUATION_SUPPRESSED_REFERENCE_INSUFFICIENT_COVERAGE
        valid_c = reference_anomaly_result.valid_observations if reference_anomaly_result else 0
        exp_c = reference_anomaly_result.expected_observations if reference_anomaly_result else 24
        suppression_msg = (
            f"Reference station '{reference_station_name}' (ID: {reference_station_id}) failed the "
            f"75% window coverage requirement ({valid_c}/{exp_c} valid observations)."
        )
    elif getattr(reference_anomaly_result.summary, "scale_indeterminate", False):
        status = SpatialScreeningStatus.EVALUATION_SUPPRESSED_REFERENCE_ZERO_MAD
        suppression_msg = (
            f"Reference station '{reference_station_name}' (ID: {reference_station_id}) has zero "
            "Median Absolute Deviation (MAD = 0). A robust scale cannot be established without arbitrary variance assumptions."
        )
    else:
        status = None
        suppression_msg = None

    # Step 2: Build window-level neighbor exclusions and identify window-eligible neighbors
    window_exclusions: List[WindowStationExclusion] = []
    window_exclusion_reasons: Dict[int, str] = {}
    window_eligible_neighbor_ids: Set[int] = set()

    # Upstream partial failures and unit mismatches
    for pf_id in (partial_failure_ids or []):
        reason = "UNIT_MISMATCH" if (unit_mismatch_ids and pf_id in unit_mismatch_ids) else "UPSTREAM_FAILURE"
        name = station_names.get(pf_id, f"Station {pf_id}")
        window_exclusions.append(
            WindowStationExclusion(
                location_id=pf_id,
                station_name=name,
                reason_code=reason,
                message=f"Station excluded from screening across window ({reason}).",
            )
        )
        window_exclusion_reasons[pf_id] = reason

    for nid in all_neighbor_ids:
        if nid in window_exclusion_reasons:
            continue
        n_res = neighbor_anomaly_results.get(nid)
        name = station_names.get(nid, f"Station {nid}")
        if n_res is None or not n_res.is_coverage_satisfied:
            valid_c = n_res.valid_observations if n_res else 0
            exp_c = n_res.expected_observations if n_res else (168 if norm_preset in ("7d", "168h") else 24)
            window_exclusions.append(
                WindowStationExclusion(
                    location_id=nid,
                    station_name=name,
                    reason_code="INSUFFICIENT_WINDOW_COVERAGE",
                    message=f"Station failed the 75% window coverage requirement ({valid_c}/{exp_c} valid observations).",
                )
            )
            window_exclusion_reasons[nid] = "INSUFFICIENT_WINDOW_COVERAGE"
        elif getattr(n_res.summary, "scale_indeterminate", False):
            window_exclusions.append(
                WindowStationExclusion(
                    location_id=nid,
                    station_name=name,
                    reason_code="INDETERMINATE_ZERO_MAD",
                    message="Station baseline has zero Median Absolute Deviation (MAD = 0).",
                )
            )
            window_exclusion_reasons[nid] = "INDETERMINATE_ZERO_MAD"
        else:
            window_eligible_neighbor_ids.add(nid)

    # Check if any eligible neighbors exist
    if status is None and len(window_eligible_neighbor_ids) == 0:
        status = SpatialScreeningStatus.EVALUATION_SUPPRESSED_NO_ELIGIBLE_NEIGHBORS
        suppression_msg = "No neighboring stations satisfied the 75% window coverage gate with valid baseline dispersion."

    if status is None:
        status = SpatialScreeningStatus.EVALUATED

    # Step 3: Build timestamp-indexed score lookups for reference and eligible neighbors
    # Maps station_id -> timestamp -> {"modified_z": float, "scale_state": str, "value": float}
    scores_by_ts: Dict[int, Dict[datetime, Dict[str, Any]]] = {}

    def index_anomaly_result(sid: int, a_res: Optional[Any]) -> None:
        if not a_res or not hasattr(a_res, "observations"):
            return
        station_scores = scores_by_ts.setdefault(sid, {})
        meas_pts = (measurements_by_station or {}).get(sid, [])
        from_by_to: Dict[datetime, datetime] = {}
        for pt in meas_pts:
            t_to = pt.datetime_to_utc
            t_from = pt.datetime_from_utc
            if t_to.tzinfo is None:
                t_to = t_to.replace(tzinfo=timezone.utc)
            if t_from.tzinfo is None:
                t_from = t_from.replace(tzinfo=timezone.utc)
            from_by_to[t_to] = t_from

        for obs in a_res.observations:
            obs_dt = obs.datetime_utc
            if obs_dt.tzinfo is None:
                obs_dt = obs_dt.replace(tzinfo=timezone.utc)
            scale_st = obs.scale_state.value if hasattr(obs.scale_state, "value") else str(obs.scale_state)
            data_dict = {
                "modified_z": obs.modified_z_score,
                "scale_state": scale_st,
                "value": obs.observed_value,
            }
            # Index by obs_dt (datetime_to_utc)
            station_scores[obs_dt] = data_dict
            # Index by matching datetime_from_utc
            ts_from = from_by_to.get(obs_dt)
            if ts_from:
                station_scores[ts_from] = data_dict

    index_anomaly_result(reference_station_id, reference_anomaly_result)
    for nid, n_res in neighbor_anomaly_results.items():
        if nid in window_eligible_neighbor_ids:
            index_anomaly_result(nid, n_res)

    # Step 4: Evaluate each time slice
    hourly_screenings: List[HourlyNeighborhoodScreening] = []

    for s in time_slices:
        ts = s.datetime_utc
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        local_ts = s.datetime_local

        if status != SpatialScreeningStatus.EVALUATED:
            # Globally suppressed evaluation
            if status == SpatialScreeningStatus.EVALUATION_SUPPRESSED_UNSUPPORTED_WINDOW:
                subclass = "UNSUPPORTED_COMPARISON_WINDOW"
                ref_elig = "UNAVAILABLE"
            elif status == SpatialScreeningStatus.EVALUATION_SUPPRESSED_REFERENCE_INSUFFICIENT_COVERAGE:
                subclass = "REFERENCE_COVERAGE_FAILURE"
                ref_elig = "INSUFFICIENT_COVERAGE"
            elif status == SpatialScreeningStatus.EVALUATION_SUPPRESSED_REFERENCE_ZERO_MAD:
                subclass = "REFERENCE_ZERO_MAD_INDETERMINATE"
                ref_elig = "ZERO_MAD"
            else:
                subclass = "FEWER_THAN_TWO_ELIGIBLE_NEIGHBORS"
                ref_elig = "ELIGIBLE"

            # Count reporting neighbors even when suppressed
            rep_count = sum(1 for nid in all_neighbor_ids if s.station_values.get(nid) is not None)

            hourly_screenings.append(
                HourlyNeighborhoodScreening(
                    datetime_utc=ts,
                    datetime_local=local_ts,
                    classification=SpatialScreeningClassification.INSUFFICIENT_SPATIAL_EVIDENCE,
                    subclassification=subclass,
                    reference_station_id=reference_station_id,
                    reference_modified_z=None,
                    is_reference_elevated=False,
                    is_reference_spike=False,
                    reference_eligibility=ref_elig,
                    neighbors_reporting_count=rep_count,
                    neighbors_window_eligible_count=len(window_eligible_neighbor_ids),
                    neighbors_comparable_count=0,
                    elevated_neighbors_count=0,
                    contributing_neighbor_ids=[],
                    elevated_neighbor_ids=[],
                    timestamp_exclusions=[],
                    evidence_statement=suppression_msg or "Screening evaluation suppressed.",
                )
            )
            continue

        # Status is EVALUATED: evaluate reference station at this slice
        ref_val = s.station_values.get(reference_station_id)
        if ref_val is None:
            ref_missing = True
            ref_mod_z = None
            ref_elig = "MISSING_OBSERVATION"
        else:
            ref_info = scores_by_ts.get(reference_station_id, {}).get(ts)
            if ref_info is None or ref_info.get("modified_z") is None:
                ref_missing = False
                ref_mod_z = None
                scale_st = ref_info.get("scale_state") if ref_info else None
                ref_elig = "ZERO_MAD" if scale_st == "INDETERMINATE_ZERO_MAD" else "INVALID_SCORE"
            else:
                ref_missing = False
                ref_mod_z = ref_info["modified_z"]
                ref_elig = "ELIGIBLE"

        # Evaluate neighbor stations at this slice
        reporting_count = 0
        comparable_neighbors: List[Dict[str, Any]] = []
        timestamp_exclusions: List[HourlyStationExclusion] = []

        for nid in all_neighbor_ids:
            n_val = s.station_values.get(nid)
            is_rep = n_val is not None
            if is_rep:
                reporting_count += 1

            if nid in window_exclusion_reasons:
                reason = window_exclusion_reasons[nid]
                timestamp_exclusions.append(
                    HourlyStationExclusion(
                        location_id=nid,
                        station_name=station_names.get(nid, f"Station {nid}"),
                        reason_code=reason,
                        message=f"Station excluded from anomaly screening across window ({reason}).",
                    )
                )
            elif not is_rep:
                timestamp_exclusions.append(
                    HourlyStationExclusion(
                        location_id=nid,
                        station_name=station_names.get(nid, f"Station {nid}"),
                        reason_code="MISSING_HOURLY_OBSERVATION",
                        message="Observation gap at this timestamp.",
                    )
                )
            else:
                n_info = scores_by_ts.get(nid, {}).get(ts)
                if n_info is None or n_info.get("modified_z") is None:
                    timestamp_exclusions.append(
                        HourlyStationExclusion(
                            location_id=nid,
                            station_name=station_names.get(nid, f"Station {nid}"),
                            reason_code="INDETERMINATE_ZERO_MAD",
                            message="Observation has zero dispersion (MAD=0) at this timestamp.",
                        )
                    )
                else:
                    comparable_neighbors.append({"location_id": nid, "modified_z": n_info["modified_z"]})

        neighbors_comparable_count = len(comparable_neighbors)
        elevated_neighbors = [n for n in comparable_neighbors if n["modified_z"] >= 2.5]
        elevated_neighbors_count = len(elevated_neighbors)
        contributing_neighbor_ids = [n["location_id"] for n in comparable_neighbors]
        elevated_neighbor_ids = [n["location_id"] for n in elevated_neighbors]

        is_ref_elevated = ref_mod_z is not None and ref_mod_z >= 2.5
        is_ref_spike = ref_mod_z is not None and ref_mod_z >= 3.5

        # Decision Logic (Ordered by strict priority)
        if ref_missing:
            classification = SpatialScreeningClassification.INSUFFICIENT_SPATIAL_EVIDENCE
            subclass = "MISSING_REFERENCE_OBSERVATION"
            evidence = "Reference station has an observation gap at this timestamp."
            timestamp_exclusions.insert(
                0,
                HourlyStationExclusion(
                    location_id=reference_station_id,
                    station_name=reference_station_name,
                    reason_code="MISSING_HOURLY_OBSERVATION",
                    message="Reference station has an observation gap at this timestamp.",
                ),
            )
        elif ref_mod_z is None:
            classification = SpatialScreeningClassification.INSUFFICIENT_SPATIAL_EVIDENCE
            subclass = "INVALID_REFERENCE_SCORE"
            reason_c = "INDETERMINATE_ZERO_MAD" if ref_elig == "ZERO_MAD" else "INVALID_SCORE"
            evidence = "Reference station score is invalid or indeterminate at this timestamp."
            timestamp_exclusions.insert(
                0,
                HourlyStationExclusion(
                    location_id=reference_station_id,
                    station_name=reference_station_name,
                    reason_code=reason_c,
                    message="Reference station score is indeterminate or zero-MAD at this timestamp.",
                ),
            )
        elif neighbors_comparable_count < 2:
            classification = SpatialScreeningClassification.INSUFFICIENT_SPATIAL_EVIDENCE
            subclass = "FEWER_THAN_TWO_ELIGIBLE_NEIGHBORS"
            evidence = (
                f"Insufficient comparable neighboring stations (only {neighbors_comparable_count} available; "
                "minimum 2 required with valid non-zero baseline dispersion)."
            )
        elif is_ref_elevated and elevated_neighbors_count >= 1:
            classification = SpatialScreeningClassification.MULTI_STATION_CONCURRENT_ELEVATION
            subclass = "SPIKE_CONCURRENT" if is_ref_spike else "MODERATE_CONCURRENT"
            evidence = (
                f"Reference station recorded an elevated concentration (M={ref_mod_z:+.2f}), corroborated by "
                f"{elevated_neighbors_count} of {neighbors_comparable_count} comparable neighboring stations (M >= +2.5)."
            )
        elif is_ref_elevated and elevated_neighbors_count == 0:
            classification = SpatialScreeningClassification.STATION_LOCALIZED_ELEVATION
            subclass = "SPIKE_LOCALIZED" if is_ref_spike else "MODERATE_LOCALIZED"
            evidence = (
                f"Reference station recorded an elevated concentration (M={ref_mod_z:+.2f}), while 0 of "
                f"{neighbors_comparable_count} comparable neighboring stations showed elevation (all M < +2.5)."
            )
        elif not is_ref_elevated and elevated_neighbors_count >= 1:
            classification = SpatialScreeningClassification.NEIGHBOR_ELEVATION_ONLY
            subclass = "PERIPHERAL_ELEVATION"
            evidence = (
                f"Reference station is within normal baseline bounds (M={ref_mod_z:+.2f}), but "
                f"{elevated_neighbors_count} of {neighbors_comparable_count} comparable neighboring stations "
                "exhibited elevated concentrations (M >= +2.5)."
            )
        else:
            classification = SpatialScreeningClassification.BASELINE_CONSISTENT
            subclass = "REGIONAL_NORMAL"
            evidence = (
                f"Reference station (M={ref_mod_z:+.2f}) and all {neighbors_comparable_count} comparable neighboring "
                "stations operated within normal baseline limits (all M < +2.5)."
            )

        hourly_screenings.append(
            HourlyNeighborhoodScreening(
                datetime_utc=ts,
                datetime_local=local_ts,
                classification=classification,
                subclassification=subclass,
                reference_station_id=reference_station_id,
                reference_modified_z=ref_mod_z,
                is_reference_elevated=is_ref_elevated,
                is_reference_spike=is_ref_spike,
                reference_eligibility=ref_elig,
                neighbors_reporting_count=reporting_count,
                neighbors_window_eligible_count=len(window_eligible_neighbor_ids),
                neighbors_comparable_count=neighbors_comparable_count,
                elevated_neighbors_count=elevated_neighbors_count,
                contributing_neighbor_ids=contributing_neighbor_ids,
                elevated_neighbor_ids=elevated_neighbor_ids,
                timestamp_exclusions=timestamp_exclusions,
                evidence_statement=evidence,
            )
        )

    # Step 5: Compute window summary metrics (guaranteeing exact reconciliation)
    if status != SpatialScreeningStatus.EVALUATED:
        evaluable_hours = 0
        concurrent_count = 0
        localized_count = 0
        neighbor_only_count = 0
        baseline_consistent_count = 0
        insufficient_count = total_window_hours
        evaluable_pct = 0.0 if total_window_hours > 0 else None
        concurrent_pct = None
        localized_pct = None
        neighbor_only_pct = None
        baseline_consistent_pct = None
    else:
        concurrent_count = sum(
            1 for h in hourly_screenings if h.classification == SpatialScreeningClassification.MULTI_STATION_CONCURRENT_ELEVATION
        )
        localized_count = sum(
            1 for h in hourly_screenings if h.classification == SpatialScreeningClassification.STATION_LOCALIZED_ELEVATION
        )
        neighbor_only_count = sum(
            1 for h in hourly_screenings if h.classification == SpatialScreeningClassification.NEIGHBOR_ELEVATION_ONLY
        )
        baseline_consistent_count = sum(
            1 for h in hourly_screenings if h.classification == SpatialScreeningClassification.BASELINE_CONSISTENT
        )
        insufficient_count = sum(
            1 for h in hourly_screenings if h.classification == SpatialScreeningClassification.INSUFFICIENT_SPATIAL_EVIDENCE
        )
        evaluable_hours = concurrent_count + localized_count + neighbor_only_count + baseline_consistent_count

        evaluable_pct = round((evaluable_hours / total_window_hours) * 100, 1) if total_window_hours > 0 else None
        concurrent_pct = round((concurrent_count / evaluable_hours) * 100, 1) if evaluable_hours > 0 else None
        localized_pct = round((localized_count / evaluable_hours) * 100, 1) if evaluable_hours > 0 else None
        neighbor_only_pct = round((neighbor_only_count / evaluable_hours) * 100, 1) if evaluable_hours > 0 else None
        baseline_consistent_pct = (
            round((baseline_consistent_count / evaluable_hours) * 100, 1) if evaluable_hours > 0 else None
        )

    summary = NeighborhoodScreeningSummary(
        evaluation_status=status,
        suppression_reason=suppression_msg,
        window_preset=norm_preset,
        total_window_hours=total_window_hours,
        evaluable_hours_count=evaluable_hours,
        concurrent_elevation_hours_count=concurrent_count,
        station_localized_elevation_hours_count=localized_count,
        neighbor_only_elevation_hours_count=neighbor_only_count,
        baseline_consistent_hours_count=baseline_consistent_count,
        insufficient_evidence_hours_count=insufficient_count,
        evaluable_percentage_of_window=evaluable_pct,
        concurrent_elevation_percentage_of_evaluable=concurrent_pct,
        station_localized_percentage_of_evaluable=localized_pct,
        neighbor_only_percentage_of_evaluable=neighbor_only_pct,
        baseline_consistent_percentage_of_evaluable=baseline_consistent_pct,
        window_exclusions=window_exclusions,
    )

    return hourly_screenings, summary

