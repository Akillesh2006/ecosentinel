"""Core spatial geometry foundation for EcoSentinel.

Provides pure Python spherical distance calculations (Haversine great-circle approximation),
coordinate validation, bounding-box calculations, and robust cross-station statistical aggregations.
"""

import math
from typing import Any, Dict, List, Optional, Tuple

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

