"""Comprehensive unit and API test suite for EcoSentinel spatial geometry and multi-station comparison.

EcoSentinel Milestone 7 Phase A.
"""

from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch
import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.spatial import (
    EARTH_RADIUS_KM,
    haversine_distance_km,
    is_valid_coordinate,
    is_within_radius,
    calculate_bounding_box,
    calculate_neighborhood_median,
    calculate_neighborhood_iqr,
    calculate_pairwise_pearson_correlation,
)
from app.main import app
from app.schemas.air_quality import Coordinates, LocationDetail, LocationMeasurementsResponse, MeasurementPoint, SensorSummary
from app.schemas.spatial import SpatialComparisonRequest

client = TestClient(app)

# ---------------------------------------------------------------------------
# Section 1: Pure Geodetic Math & Spatial Core Unit Tests
# ---------------------------------------------------------------------------


def test_is_valid_coordinate():
    """Validates boundary conditions and type screening for geographic coordinates."""
    # Valid coordinates
    assert is_valid_coordinate(0.0, 0.0) is True
    assert is_valid_coordinate(28.6139, 77.2090) is True
    assert is_valid_coordinate(-90.0, -180.0) is True
    assert is_valid_coordinate(90.0, 180.0) is True
    assert is_valid_coordinate(0, 0) is True

    # Invalid coordinates
    assert is_valid_coordinate(None, 77.0) is False
    assert is_valid_coordinate(28.0, None) is False
    assert is_valid_coordinate("28.0", 77.0) is False
    assert is_valid_coordinate(True, 77.0) is False
    assert is_valid_coordinate(90.001, 77.0) is False
    assert is_valid_coordinate(-90.1, 77.0) is False
    assert is_valid_coordinate(28.0, 180.001) is False
    assert is_valid_coordinate(28.0, -180.1) is False
    assert is_valid_coordinate(float("nan"), 77.0) is False
    assert is_valid_coordinate(28.0, float("inf")) is False


def test_haversine_known_references():
    """Tests Haversine distance against standard geodetic reference baselines."""
    # 1. Identical coordinates must be exactly 0.0
    assert haversine_distance_km(28.6139, 77.2090, 28.6139, 77.2090) == 0.0
    assert haversine_distance_km(0.0, 0.0, 0.0, 0.0) == 0.0

    # 2. 1 degree longitude at Equator (d = R * (pi / 180) ~ 111.195 km)
    d_eq = haversine_distance_km(0.0, 0.0, 0.0, 1.0)
    expected_1deg = EARTH_RADIUS_KM * (3.141592653589793 / 180.0)
    assert abs(d_eq - expected_1deg) < 1e-4

    # 3. Equator to North Pole (90 deg latitude = quarter circumference ~ 10,007.56 km)
    d_pole = haversine_distance_km(0.0, 0.0, 90.0, 0.0)
    assert abs(d_pole - 10007.557) < 0.1

    # 4. Delhi (28.6139, 77.2090) to Mumbai (19.0760, 72.8777) ~ 1148 km
    d_delhi_mumbai = haversine_distance_km(28.6139, 77.2090, 19.0760, 72.8777)
    assert 1140.0 < d_delhi_mumbai < 1160.0

    # 5. Antipodal points (0, 0) to (0, 180) ~ pi * R ~ 20015.11 km
    d_antipode = haversine_distance_km(0.0, 0.0, 0.0, 180.0)
    assert abs(d_antipode - 20015.11) < 0.2


def test_haversine_symmetry_and_non_negativity():
    """Confirms distance is strictly symmetric and non-negative."""
    points = [
        (28.6139, 77.2090),
        (13.0827, 80.2707),
        (12.9716, 77.5946),
        (-33.8688, 151.2093),
    ]
    for i in range(len(points)):
        for j in range(len(points)):
            lat1, lon1 = points[i]
            lat2, lon2 = points[j]
            d12 = haversine_distance_km(lat1, lon1, lat2, lon2)
            d21 = haversine_distance_km(lat2, lon2, lat1, lon1)
            assert d12 >= 0.0
            assert d12 == d21


def test_haversine_invalid_coordinates_raise_value_error():
    """Confirms invalid coordinates raise descriptive ValueError."""
    with pytest.raises(ValueError, match="Invalid coordinates"):
        haversine_distance_km(95.0, 77.0, 28.0, 77.0)

    with pytest.raises(ValueError, match="Invalid coordinates"):
        haversine_distance_km(28.0, 77.0, 28.0, -190.0)


def test_is_within_radius():
    """Confirms radius boundary inclusion and negative radius guard."""
    # Anand Vihar (28.6476, 77.3158) to Connaught Place (28.6315, 77.2167) ~ 9.8 km
    lat1, lon1 = 28.6476, 77.3158
    lat2, lon2 = 28.6315, 77.2167
    dist = haversine_distance_km(lat1, lon1, lat2, lon2)

    assert is_within_radius(lat1, lon1, lat2, lon2, radius_km=dist + 0.1) is True
    assert is_within_radius(lat1, lon1, lat2, lon2, radius_km=dist - 0.1) is False

    with pytest.raises(ValueError, match="Radius cannot be negative"):
        is_within_radius(lat1, lon1, lat2, lon2, radius_km=-5.0)


def test_calculate_bounding_box():
    """Tests bounding box calculation, pole boundary clipping, and antimeridian crossing."""
    # Delhi 25 km
    bbox = calculate_bounding_box(28.6139, 77.2090, radius_km=25.0)
    assert bbox["min_latitude"] < 28.6139 < bbox["max_latitude"]
    assert bbox["min_longitude"] < 77.2090 < bbox["max_longitude"]
    assert bbox["crosses_antimeridian"] is False

    # Near North Pole (89 deg lat with 200 km radius overlaps pole)
    bbox_pole = calculate_bounding_box(89.0, 0.0, radius_km=200.0)
    assert bbox_pole["max_latitude"] == 90.0
    assert bbox_pole["min_longitude"] == -180.0
    assert bbox_pole["max_longitude"] == 180.0

    # Near antimeridian (179 deg lon with 150 km radius)
    bbox_anti = calculate_bounding_box(0.0, 179.5, radius_km=150.0)
    assert bbox_anti["crosses_antimeridian"] is True
    assert "antimeridian_boxes" in bbox_anti

    with pytest.raises(ValueError, match="strictly positive"):
        calculate_bounding_box(28.0, 77.0, radius_km=0.0)


def test_neighborhood_median_and_iqr():
    """Tests median and IQR across contributing stations."""
    # < 2 contributors returns None
    assert calculate_neighborhood_median([]) is None
    assert calculate_neighborhood_median([45.0]) is None
    assert calculate_neighborhood_iqr([45.0]) is None

    # 2 contributors
    assert calculate_neighborhood_median([20.0, 40.0]) == 30.0
    assert calculate_neighborhood_iqr([20.0, 40.0]) == 10.0

    # 3 contributors (odd count)
    assert calculate_neighborhood_median([10.0, 30.0, 20.0]) == 20.0

    # 4 contributors (even count)
    assert calculate_neighborhood_median([10.0, 20.0, 30.0, 40.0]) == 25.0

    # Missing values (None/NaN) are excluded before calculation
    assert calculate_neighborhood_median([10.0, None, 30.0]) == 20.0


def test_calculate_pairwise_pearson_correlation():
    """Tests Pearson correlation with safeguards for constant series and small sample size."""
    # 1. Perfect positive correlation (N=6)
    s_a = [10.0, 20.0, 30.0, 40.0, 50.0, 60.0]
    s_b = [15.0, 25.0, 35.0, 45.0, 55.0, 65.0]
    corr, status = calculate_pairwise_pearson_correlation(s_a, s_b, min_coincident=6)
    assert corr == 1.0
    assert status == "CALCULATED"

    # 2. Perfect negative correlation
    s_neg = [60.0, 50.0, 40.0, 30.0, 20.0, 10.0]
    corr_neg, status_neg = calculate_pairwise_pearson_correlation(s_a, s_neg, min_coincident=6)
    assert corr_neg == -1.0
    assert status_neg == "CALCULATED"

    # 3. Insufficient coincident points (< 6)
    s_short_a = [10.0, 20.0, 30.0, None, 50.0, None]
    s_short_b = [15.0, 25.0, 35.0, 45.0, 55.0, 65.0]
    corr_short, status_short = calculate_pairwise_pearson_correlation(s_short_a, s_short_b, min_coincident=6)
    assert corr_short is None
    assert status_short == "INSUFFICIENT_COINCIDENT_DATA"

    # 4. Zero variance / constant series
    s_const = [25.0, 25.0, 25.0, 25.0, 25.0, 25.0]
    corr_const, status_const = calculate_pairwise_pearson_correlation(s_a, s_const, min_coincident=6)
    assert corr_const is None
    assert status_const == "ZERO_VARIANCE_CONSTANT_SERIES"

    # 5. Length mismatch raises ValueError
    with pytest.raises(ValueError, match="length mismatch"):
        calculate_pairwise_pearson_correlation([1.0], [1.0, 2.0])


# ---------------------------------------------------------------------------
# Section 2: Pydantic Validation & Request Guard Tests
# ---------------------------------------------------------------------------


def test_spatial_comparison_request_validation():
    """Tests SpatialComparisonRequest model validation rules."""
    # Valid 2 to 5 stations
    valid_req = SpatialComparisonRequest(
        reference_location_id=101,
        neighbor_location_ids=[102, 103],
        parameter="pm25",
    )
    assert valid_req.reference_location_id == 101
    assert len(valid_req.neighbor_location_ids) == 2

    # Reject duplicate IDs
    with pytest.raises(ValueError, match="Duplicate station IDs found"):
        SpatialComparisonRequest(
            reference_location_id=101,
            neighbor_location_ids=[102, 102],
            parameter="pm25",
        )

    # Reject reference station included in neighbor IDs
    with pytest.raises(ValueError, match="cannot be included in neighbor_location_ids"):
        SpatialComparisonRequest(
            reference_location_id=101,
            neighbor_location_ids=[101, 102],
            parameter="pm25",
        )

    # Reject > 4 neighbors (> 5 total)
    with pytest.raises(ValueError, match="between 1 and 4"):
        SpatialComparisonRequest(
            reference_location_id=101,
            neighbor_location_ids=[102, 103, 104, 105, 106],
            parameter="pm25",
        )

    # Reject 0 neighbors (< 2 total)
    with pytest.raises(ValueError, match="between 1 and 4"):
        SpatialComparisonRequest(
            reference_location_id=101,
            neighbor_location_ids=[],
            parameter="pm25",
        )

    # Reject inverted dates
    now = datetime.now(timezone.utc)
    with pytest.raises(ValueError, match="earlier than date_to"):
        SpatialComparisonRequest(
            reference_location_id=101,
            neighbor_location_ids=[102],
            parameter="pm25",
            date_from=now,
            date_to=now - timedelta(hours=5),
        )


# ---------------------------------------------------------------------------
# Section 3: Neighbor Discovery API Tests (/spatial/neighbors)
# ---------------------------------------------------------------------------


@pytest.fixture
def mock_reference_location():
    """Mock LocationDetail for reference station Anand Vihar, Delhi."""
    return LocationDetail(
        id=8118,
        name="Anand Vihar, Delhi - DPCC",
        locality="Delhi",
        country_code="IN",
        country_name="India",
        provider_name="CPCB",
        owner_name="DPCC",
        coordinates=Coordinates(latitude=28.6476, longitude=77.3158),
        available_parameters=["pm25", "pm10", "no2"],
        sensors=[
            SensorSummary(
                id=101,
                name="pm25",
                parameter_id=2,
                parameter_name="pm25",
                parameter_display_name="PM2.5",
                units="µg/m³",
            )
        ],
    )


def test_discover_neighbors_endpoint_success(mock_reference_location):
    """Tests neighbor discovery with comprehensive exclusion counts and sorting."""
    # Mock candidates returned from OpenAQ near Anand Vihar (28.6476, 77.3158)
    mock_candidates = [
        # Candidate 1: 5.5 km away, has pm25 -> Eligible
        {
            "id": 8119,
            "name": "Vivek Vihar, Delhi - DPCC",
            "locality": "Delhi",
            "country": {"code": "IN"},
            "provider": {"name": "CPCB"},
            "owner": {"name": "DPCC"},
            "coordinates": {"latitude": 28.6723, "longitude": 77.3152},
            "sensors": [{"id": 201, "parameter": {"name": "pm25"}}],
            "datetimeLast": {"utc": "2026-11-02T12:00:00Z"},
        },
        # Candidate 2: 14.0 km away, has pm25 -> Eligible
        {
            "id": 8120,
            "name": "Connaught Place, Delhi - DPCC",
            "locality": "Delhi",
            "country": {"code": "IN"},
            "provider": {"name": "CPCB"},
            "owner": {"name": "DPCC"},
            "coordinates": {"latitude": 28.6315, "longitude": 77.2167},
            "sensors": [{"id": 202, "parameter": {"name": "pm25"}}],
            "datetimeLast": {"utc": "2026-11-02T12:00:00Z"},
        },
        # Candidate 3: Same station (ID 8118) -> Self excluded
        {
            "id": 8118,
            "name": "Anand Vihar, Delhi - DPCC",
            "coordinates": {"latitude": 28.6476, "longitude": 77.3158},
            "sensors": [{"id": 101, "parameter": {"name": "pm25"}}],
        },
        # Candidate 4: 8 km away, lacks pm25 (has only no2) -> Pollutant incompatible excluded
        {
            "id": 8121,
            "name": "Gases Only Station",
            "coordinates": {"latitude": 28.6500, "longitude": 77.2500},
            "sensors": [{"id": 203, "parameter": {"name": "no2"}}],
        },
        # Candidate 5: Missing coordinates -> Missing coords excluded
        {
            "id": 8122,
            "name": "No Coords Station",
            "coordinates": None,
            "sensors": [{"id": 204, "parameter": {"name": "pm25"}}],
        },
        # Candidate 6: 45 km away (outside radius 25 km) -> Outside radius excluded
        {
            "id": 8123,
            "name": "Far Station",
            "coordinates": {"latitude": 28.2500, "longitude": 77.3158},
            "sensors": [{"id": 205, "parameter": {"name": "pm25"}}],
        },
    ]

    with patch("app.services.spatial.openaq_service.is_configured", return_value=True), \
         patch("app.services.spatial.openaq_service.get_location_detail", AsyncMock(return_value=mock_reference_location)), \
         patch("httpx.AsyncClient.get") as mock_get:

        mock_resp = httpx.Response(
            200,
            json={"meta": {"found": 6}, "results": mock_candidates},
            request=httpx.Request("GET", "https://api.openaq.org/v3/locations"),
        )
        mock_get.return_value = mock_resp

        response = client.get(
            "/api/air-quality/spatial/neighbors?reference_location_id=8118&parameter=pm25&radius_km=25.0"
        )
        assert response.status_code == 200
        data = response.json()

        # Audit diagnostic counts
        assert data["reference_station_id"] == 8118
        assert data["parameter"] == "pm25"
        assert data["radius_km"] == 25.0
        assert data["candidates_examined_count"] == 6
        assert data["eligible_neighbors_count"] == 2
        assert data["self_excluded_count"] == 1
        assert data["pollutant_incompatible_count"] == 1
        assert data["missing_coordinates_count"] == 1
        assert data["outside_radius_count"] == 1

        # Check sorting: closest station (Vivek Vihar ~ 2.7 km) first, Connaught Place second
        neighbors = data["neighbors"]
        assert len(neighbors) == 2
        assert neighbors[0]["id"] == 8119
        assert neighbors[1]["id"] == 8120
        assert neighbors[0]["distance_km"] < neighbors[1]["distance_km"]
        assert "spatial_disclaimer" in data


def test_discover_neighbors_reference_missing_coordinates():
    """Fails with 422 if reference station lacks valid geographic coordinates."""
    bad_ref = LocationDetail(
        id=9999,
        name="Station Without Coords",
        country_code="IN",
        provider_name="CPCB",
        coordinates=None,
        available_parameters=["pm25"],
        sensors=[SensorSummary(id=1, name="pm25", parameter_id=2, parameter_name="pm25", parameter_display_name="PM2.5", units="µg/m³")],
    )

    with patch("app.services.spatial.openaq_service.is_configured", return_value=True), \
         patch("app.services.spatial.openaq_service.get_location_detail", AsyncMock(return_value=bad_ref)):

        response = client.get("/api/air-quality/spatial/neighbors?reference_location_id=9999&parameter=pm25")
        assert response.status_code == 422
        data = response.json()
        assert data["error_code"] == "REFERENCE_COORDINATES_MISSING"


def test_discover_neighbors_reference_pollutant_unavailable(mock_reference_location):
    """Fails with 400 if reference station does not monitor the queried pollutant."""
    with patch("app.services.spatial.openaq_service.is_configured", return_value=True), \
         patch("app.services.spatial.openaq_service.get_location_detail", AsyncMock(return_value=mock_reference_location)):

        response = client.get("/api/air-quality/spatial/neighbors?reference_location_id=8118&parameter=so2")
        assert response.status_code == 400
        data = response.json()
        assert data["error_code"] == "REFERENCE_POLLUTANT_UNAVAILABLE"


def test_discover_neighbors_invalid_radius():
    """Fails with 422 if radius exceeds [1.0, 100.0] bounds."""
    response_low = client.get("/api/air-quality/spatial/neighbors?reference_location_id=8118&parameter=pm25&radius_km=0.5")
    assert response_low.status_code == 422

    response_high = client.get("/api/air-quality/spatial/neighbors?reference_location_id=8118&parameter=pm25&radius_km=150.0")
    assert response_high.status_code == 422


# ---------------------------------------------------------------------------
# Section 4: Multi-Station Comparison API Tests (/spatial/compare)
# ---------------------------------------------------------------------------


def make_mock_measurements(location_id: int, values_map: dict, units: str = "µg/m³") -> LocationMeasurementsResponse:
    """Helper creating mock LocationMeasurementsResponse with specified timestamp/value pairs."""
    measurements = []
    base_time = datetime(2026, 11, 2, 0, 0, tzinfo=timezone.utc)
    for hour_idx, val in values_map.items():
        if val is not None:
            t_from = base_time + timedelta(hours=hour_idx)
            t_to = t_from + timedelta(hours=1)
            measurements.append(
                MeasurementPoint(
                    value=float(val),
                    parameter="pm25",
                    units=units,
                    period_label="hour",
                    interval="01:00:00",
                    datetime_from_utc=t_from,
                    datetime_to_utc=t_to,
                    datetime_from_local=t_from.isoformat(),
                    datetime_to_local=t_to.isoformat(),
                    is_missing=False,
                )
            )

    return LocationMeasurementsResponse(
        location_id=location_id,
        station_name=f"Station {location_id}",
        provider_name="CPCB",
        parameter="pm25",
        parameter_display_name="PM2.5",
        units=units,
        sensor_id=location_id * 10,
        requested_from_utc=base_time,
        requested_to_utc=base_time + timedelta(hours=24),
        retrieved_at_utc=datetime.now(timezone.utc),
        total_observations=len(measurements),
        expected_observations=24,
        missing_percentage=round((1.0 - (len(measurements) / 24.0)) * 100.0, 1),
        is_stale=False,
        measurements=measurements,
    )


def test_compare_stations_endpoint_success():
    """Tests 3-station comparison with staggered missing hours, coverage, and Pearson correlation."""
    ref_detail = LocationDetail(
        id=1001,
        name="Station Reference",
        provider_name="CPCB",
        coordinates=Coordinates(latitude=28.61, longitude=77.20),
        available_parameters=["pm25"],
        sensors=[SensorSummary(id=10010, name="pm25", parameter_id=2, parameter_name="pm25", parameter_display_name="PM2.5", units="µg/m³")],
    )
    n1_detail = LocationDetail(
        id=1002,
        name="Station Neighbor 1",
        provider_name="DPCC",
        coordinates=Coordinates(latitude=28.65, longitude=77.25),
        available_parameters=["pm25"],
        sensors=[SensorSummary(id=10020, name="pm25", parameter_id=2, parameter_name="pm25", parameter_display_name="PM2.5", units="µg/m³")],
    )
    n2_detail = LocationDetail(
        id=1003,
        name="Station Neighbor 2",
        provider_name="CPCB",
        coordinates=Coordinates(latitude=28.70, longitude=77.30),
        available_parameters=["pm25"],
        sensors=[SensorSummary(id=10030, name="pm25", parameter_id=2, parameter_name="pm25", parameter_display_name="PM2.5", units="µg/m³")],
    )

    # 1001 has 10 hours: values 10..100
    ref_vals = {i: 10.0 + i * 10.0 for i in range(10)}
    # 1002 has hours 0..9 except hour 4 is missing
    n1_vals = {i: (20.0 + i * 10.0) if i != 4 else None for i in range(10)}
    # 1003 has hours 0..9 except hour 7 is missing
    n2_vals = {i: (15.0 + i * 12.0) if i != 7 else None for i in range(10)}

    m_ref = make_mock_measurements(1001, ref_vals)
    m_n1 = make_mock_measurements(1002, n1_vals)
    m_n2 = make_mock_measurements(1003, n2_vals)

    async def mock_get_detail(sid):
        if sid == 1001:
            return ref_detail
        if sid == 1002:
            return n1_detail
        if sid == 1003:
            return n2_detail
        raise ValueError(f"Unknown {sid}")

    async def mock_get_meas(location_id, **kwargs):
        if location_id == 1001:
            return m_ref
        if location_id == 1002:
            return m_n1
        if location_id == 1003:
            return m_n2
        raise ValueError(f"Unknown {location_id}")

    with patch("app.services.spatial.openaq_service.is_configured", return_value=True), \
         patch("app.services.spatial.openaq_service.get_location_detail", side_effect=mock_get_detail), \
         patch("app.services.spatial.openaq_service.get_measurements", side_effect=mock_get_meas):

        req_payload = {
            "reference_location_id": 1001,
            "neighbor_location_ids": [1002, 1003],
            "parameter": "pm25",
            "date_from": "2026-11-02T00:00:00Z",
            "date_to": "2026-11-02T10:00:00Z",
        }
        response = client.post("/api/air-quality/spatial/compare", json=req_payload)
        assert response.status_code == 200
        data = response.json()

        assert data["total_stations_requested"] == 3
        assert data["total_valid_stations"] == 3
        assert len(data["partial_failures"]) == 0
        assert data["mixed_providers"] is True  # CPCB + DPCC

        # Staggered missing test: hour 4 must have 1002 value == None, NOT 0.0
        time_slices = data["time_slices"]
        assert len(time_slices) == 10

        slice_hr4 = time_slices[4]
        assert slice_hr4["station_values"]["1001"] == 50.0
        assert slice_hr4["station_values"]["1002"] is None
        assert slice_hr4["station_values"]["1003"] == 63.0
        assert slice_hr4["contributing_stations"] == 2
        # Median of 50.0 and 63.0 = 56.5
        assert slice_hr4["neighborhood_median"] == 56.5

        # Distance calculation
        st_metas = {s["location_id"]: s for s in data["stations"]}
        assert st_metas[1001]["distance_from_reference_km"] == 0.0
        assert st_metas[1001]["is_reference"] is True
        assert st_metas[1002]["distance_from_reference_km"] > 0.0

        # Coverage metric verifications
        # 1. Station coverage: valid / expected * 100 (10 expected hours)
        assert st_metas[1001]["station_coverage_percentage"] == 100.0
        assert st_metas[1002]["station_coverage_percentage"] == 90.0
        assert st_metas[1001]["coverage_percentage"] == 100.0  # alias

        # 2. Pairwise overlap coverage: coincident / expected * 100
        assert st_metas[1001]["pairwise_overlap_coverage_percentage"] == 100.0
        assert st_metas[1002]["pairwise_overlap_coverage_percentage"] == 90.0

        # 3. Conditional reference coverage: coincident / valid_ref * 100
        # Reference itself: 10 / 10 = 100.0%
        assert st_metas[1001]["conditional_reference_coverage_percentage"] == 100.0
        # Neighbor 1002: 9 / 10 = 90.0%
        assert st_metas[1002]["conditional_reference_coverage_percentage"] == 90.0

        # 4. All-stations coincident coverage: 8 / 10 = 80.0%
        assert data["all_stations_coincident_hours"] == 8
        assert data["all_stations_coincident_coverage_percentage"] == 80.0

        # Pearson correlation: 1001 vs 1002 (perfect linear relation r = 1.0)
        assert st_metas[1002]["correlation_status"] == "CALCULATED"
        assert st_metas[1002]["pearson_correlation_with_reference"] == 1.0


def test_compare_stations_neighbor_missing_coordinates_distance_is_none():
    """Confirms that a participating neighbor without coordinates has distance=None (not 0.0)."""
    ref_detail = LocationDetail(
        id=4001,
        name="Station Ref",
        provider_name="CPCB",
        coordinates=Coordinates(latitude=28.61, longitude=77.20),
        available_parameters=["pm25"],
        sensors=[SensorSummary(id=1, name="pm25", parameter_id=2, parameter_name="pm25", parameter_display_name="PM2.5", units="µg/m³")],
    )
    n1_detail = LocationDetail(
        id=4002,
        name="Station Without Coords",
        provider_name="CPCB",
        coordinates=None,  # Missing coordinates
        available_parameters=["pm25"],
        sensors=[SensorSummary(id=2, name="pm25", parameter_id=2, parameter_name="pm25", parameter_display_name="PM2.5", units="µg/m³")],
    )

    m_ref = make_mock_measurements(4001, {0: 10.0, 1: 20.0, 2: 30.0})
    m_n1 = make_mock_measurements(4002, {0: 12.0, 1: 22.0, 2: 32.0})

    async def mock_get_detail(sid):
        return {4001: ref_detail, 4002: n1_detail}[sid]

    async def mock_get_meas(location_id, **kwargs):
        return {4001: m_ref, 4002: m_n1}[location_id]

    with patch("app.services.spatial.openaq_service.is_configured", return_value=True), \
         patch("app.services.spatial.openaq_service.get_location_detail", side_effect=mock_get_detail), \
         patch("app.services.spatial.openaq_service.get_measurements", side_effect=mock_get_meas):

        req_payload = {
            "reference_location_id": 4001,
            "neighbor_location_ids": [4002],
            "parameter": "pm25",
        }
        response = client.post("/api/air-quality/spatial/compare", json=req_payload)
        assert response.status_code == 200
        data = response.json()

        st_metas = {s["location_id"]: s for s in data["stations"]}
        assert st_metas[4001]["distance_from_reference_km"] == 0.0
        # Crucial fix: must be None, NOT 0.0
        assert st_metas[4002]["distance_from_reference_km"] is None


def test_compare_stations_zero_denominator_coverage_safety():
    """Confirms coverage metrics return None safely when denominators are zero."""
    ref_detail = LocationDetail(
        id=5001,
        name="Station Ref",
        provider_name="CPCB",
        coordinates=Coordinates(latitude=28.61, longitude=77.20),
        available_parameters=["pm25"],
        sensors=[SensorSummary(id=1, name="pm25", parameter_id=2, parameter_name="pm25", parameter_display_name="PM2.5", units="µg/m³")],
    )
    n1_detail = LocationDetail(
        id=5002,
        name="Station Neighbor",
        provider_name="CPCB",
        coordinates=Coordinates(latitude=28.62, longitude=77.21),
        available_parameters=["pm25"],
        sensors=[SensorSummary(id=2, name="pm25", parameter_id=2, parameter_name="pm25", parameter_display_name="PM2.5", units="µg/m³")],
    )

    # Empty measurements (0 valid observations for ref and neighbor)
    m_ref = make_mock_measurements(5001, {})
    m_n1 = make_mock_measurements(5002, {})

    async def mock_get_detail(sid):
        return {5001: ref_detail, 5002: n1_detail}[sid]

    async def mock_get_meas(location_id, **kwargs):
        return {5001: m_ref, 5002: m_n1}[location_id]

    with patch("app.services.spatial.openaq_service.is_configured", return_value=True), \
         patch("app.services.spatial.openaq_service.get_location_detail", side_effect=mock_get_detail), \
         patch("app.services.spatial.openaq_service.get_measurements", side_effect=mock_get_meas):

        req_payload = {
            "reference_location_id": 5001,
            "neighbor_location_ids": [5002],
            "parameter": "pm25",
        }
        response = client.post("/api/air-quality/spatial/compare", json=req_payload)
        assert response.status_code == 200
        data = response.json()

        st_metas = {s["location_id"]: s for s in data["stations"]}
        # When ref has 0 valid observations, conditional reference coverage must be None
        assert st_metas[5001]["conditional_reference_coverage_percentage"] is None
        assert st_metas[5002]["conditional_reference_coverage_percentage"] is None


def test_compare_stations_hourly_grid_handles_blackout_hour():
    """Confirms that an hour missing across ALL stations remains present in time_slices as null."""
    ref_detail = LocationDetail(
        id=6001,
        name="Station Ref",
        provider_name="CPCB",
        coordinates=Coordinates(latitude=28.61, longitude=77.20),
        available_parameters=["pm25"],
        sensors=[SensorSummary(id=1, name="pm25", parameter_id=2, parameter_name="pm25", parameter_display_name="PM2.5", units="µg/m³")],
    )
    n1_detail = LocationDetail(
        id=6002,
        name="Station Neighbor",
        provider_name="CPCB",
        coordinates=Coordinates(latitude=28.62, longitude=77.21),
        available_parameters=["pm25"],
        sensors=[SensorSummary(id=2, name="pm25", parameter_id=2, parameter_name="pm25", parameter_display_name="PM2.5", units="µg/m³")],
    )

    # Both stations report hour 0 and hour 2, but hour 1 is missing across both!
    m_ref = make_mock_measurements(6001, {0: 40.0, 2: 50.0})
    m_n1 = make_mock_measurements(6002, {0: 42.0, 2: 52.0})

    async def mock_get_detail(sid):
        return {6001: ref_detail, 6002: n1_detail}[sid]

    async def mock_get_meas(location_id, **kwargs):
        return {6001: m_ref, 6002: m_n1}[location_id]

    with patch("app.services.spatial.openaq_service.is_configured", return_value=True), \
         patch("app.services.spatial.openaq_service.get_location_detail", side_effect=mock_get_detail), \
         patch("app.services.spatial.openaq_service.get_measurements", side_effect=mock_get_meas):

        req_payload = {
            "reference_location_id": 6001,
            "neighbor_location_ids": [6002],
            "parameter": "pm25",
            "date_from": "2026-11-02T00:00:00Z",
            "date_to": "2026-11-02T03:00:00Z",
        }
        response = client.post("/api/air-quality/spatial/compare", json=req_payload)
        assert response.status_code == 200
        data = response.json()

        # Check slices: hour 1 must be present with null values
        slices_by_iso = {s["datetime_utc"]: s for s in data["time_slices"]}
        assert "2026-11-02T01:00:00Z" in slices_by_iso
        blackout_slice = slices_by_iso["2026-11-02T01:00:00Z"]
        assert blackout_slice["station_values"]["6001"] is None
        assert blackout_slice["station_values"]["6002"] is None
        assert blackout_slice["contributing_stations"] == 0
        assert blackout_slice["neighborhood_median"] is None



def test_compare_stations_unit_mismatch():
    """Confirms station with incompatible measurement unit is placed in partial_failures."""
    ref_detail = LocationDetail(
        id=2001,
        name="Station Ref",
        provider_name="CPCB",
        coordinates=Coordinates(latitude=28.61, longitude=77.20),
        available_parameters=["co"],
        sensors=[SensorSummary(id=1, name="co", parameter_id=1, parameter_name="co", parameter_display_name="CO", units="µg/m³")],
    )
    n1_detail = LocationDetail(
        id=2002,
        name="Station PPM",
        provider_name="CPCB",
        coordinates=Coordinates(latitude=28.62, longitude=77.21),
        available_parameters=["co"],
        sensors=[SensorSummary(id=2, name="co", parameter_id=1, parameter_name="co", parameter_display_name="CO", units="ppm")],
    )
    n2_detail = LocationDetail(
        id=2003,
        name="Station Matching",
        provider_name="CPCB",
        coordinates=Coordinates(latitude=28.63, longitude=77.22),
        available_parameters=["co"],
        sensors=[SensorSummary(id=3, name="co", parameter_id=1, parameter_name="co", parameter_display_name="CO", units="µg/m³")],
    )

    m_ref = make_mock_measurements(2001, {0: 10.0, 1: 20.0}, units="µg/m³")
    m_ppm = make_mock_measurements(2002, {0: 0.1, 1: 0.2}, units="ppm")
    m_match = make_mock_measurements(2003, {0: 12.0, 1: 22.0}, units="µg/m³")

    async def mock_get_detail(sid):
        return {2001: ref_detail, 2002: n1_detail, 2003: n2_detail}[sid]

    async def mock_get_meas(location_id, **kwargs):
        return {2001: m_ref, 2002: m_ppm, 2003: m_match}[location_id]

    with patch("app.services.spatial.openaq_service.is_configured", return_value=True), \
         patch("app.services.spatial.openaq_service.get_location_detail", side_effect=mock_get_detail), \
         patch("app.services.spatial.openaq_service.get_measurements", side_effect=mock_get_meas):

        req_payload = {
            "reference_location_id": 2001,
            "neighbor_location_ids": [2002, 2003],
            "parameter": "co",
        }
        response = client.post("/api/air-quality/spatial/compare", json=req_payload)
        assert response.status_code == 200
        data = response.json()

        assert data["total_valid_stations"] == 2
        assert len(data["partial_failures"]) == 1
        assert data["partial_failures"][0]["location_id"] == 2002
        assert data["partial_failures"][0]["error_code"] == "UNIT_MISMATCH"


def test_compare_stations_insufficient_valid_stations():
    """Fails with 400 when < 2 valid stations remain after filtering."""
    ref_detail = LocationDetail(
        id=3001,
        name="Station Ref",
        provider_name="CPCB",
        coordinates=Coordinates(latitude=28.61, longitude=77.20),
        available_parameters=["pm25"],
        sensors=[SensorSummary(id=1, name="pm25", parameter_id=2, parameter_name="pm25", parameter_display_name="PM2.5", units="µg/m³")],
    )
    n1_detail = LocationDetail(
        id=3002,
        name="Station Gas Only",
        provider_name="CPCB",
        coordinates=Coordinates(latitude=28.62, longitude=77.21),
        available_parameters=["no2"],  # Lacks pm25
        sensors=[SensorSummary(id=2, name="no2", parameter_id=7, parameter_name="no2", parameter_display_name="NO₂", units="µg/m³")],
    )

    async def mock_get_detail(sid):
        return {3001: ref_detail, 3002: n1_detail}[sid]

    with patch("app.services.spatial.openaq_service.is_configured", return_value=True), \
         patch("app.services.spatial.openaq_service.get_location_detail", side_effect=mock_get_detail):

        req_payload = {
            "reference_location_id": 3001,
            "neighbor_location_ids": [3002],
            "parameter": "pm25",
        }
        response = client.post("/api/air-quality/spatial/compare", json=req_payload)
        assert response.status_code == 400
        data = response.json()
        assert data["error_code"] == "INSUFFICIENT_VALID_STATIONS"

