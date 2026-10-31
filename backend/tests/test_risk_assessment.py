"""
Automated unit and integration test suite for EcoSentinel Milestone 3:
Operational Risk Assessment and Mitigation Advisory Engine.
"""

from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch
import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.core.standards import calculate_idling_abatement
from app.main import app

client = TestClient(app)

FIXED_NOW = datetime(2026, 10, 28, 12, 0, 0, tzinfo=timezone.utc)
REF_ISO = FIXED_NOW.strftime("%Y-%m-%dT%H:%M:%SZ")

MOCK_STATION_WITH_ALL_SENSORS = {
    "meta": {"name": "openaq-api", "page": 1, "limit": 1, "found": 1},
    "results": [
        {
            "id": 8118,
            "name": "Anand Vihar, Delhi - DPCC",
            "locality": "Delhi",
            "timezone": "Asia/Kolkata",
            "country": {"id": 1, "code": "IN", "name": "India"},
            "owner": {"id": 1, "name": "Delhi Pollution Control Committee"},
            "provider": {"id": 1, "name": "CPCB"},
            "isMobile": False,
            "isMonitor": True,
            "instruments": [{"id": 1, "name": "Continuous Ambient Air Quality Monitoring Station"}],
            "coordinates": {"latitude": 28.6476, "longitude": 77.3158},
            "licenses": [{"id": 1, "name": "Open Government Data License - India"}],
            "datetimeFirst": {"utc": "2018-01-01T00:00:00Z", "local": "2018-01-01T05:30:00+05:30"},
            "datetimeLast": {"utc": "2026-10-28T11:00:00Z", "local": "2026-10-28T16:30:00+05:30"},
            "sensors": [
                {
                    "id": 101,
                    "name": "pm25 ug/m3",
                    "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                    "datetimeLast": {"utc": "2026-10-28T11:00:00Z", "local": "2026-10-28T16:30:00+05:30"},
                },
                {
                    "id": 102,
                    "name": "pm10 ug/m3",
                    "parameter": {"id": 1, "name": "pm10", "units": "µg/m³", "displayName": "PM10"},
                    "datetimeLast": {"utc": "2026-10-28T11:00:00Z", "local": "2026-10-28T16:30:00+05:30"},
                },
                {
                    "id": 103,
                    "name": "no2 ug/m3",
                    "parameter": {"id": 7, "name": "no2", "units": "µg/m³", "displayName": "NO₂"},
                    "datetimeLast": {"utc": "2026-10-28T11:00:00Z", "local": "2026-10-28T16:30:00+05:30"},
                },
                {
                    "id": 104,
                    "name": "o3 ug/m3",
                    "parameter": {"id": 3, "name": "o3", "units": "µg/m³", "displayName": "Ozone"},
                    "datetimeLast": {"utc": "2026-10-28T11:00:00Z", "local": "2026-10-28T16:30:00+05:30"},
                },
                {
                    "id": 105,
                    "name": "co mg/m3",
                    "parameter": {"id": 8, "name": "co", "units": "mg/m³", "displayName": "Carbon Monoxide"},
                    "datetimeLast": {"utc": "2026-10-28T11:00:00Z", "local": "2026-10-28T16:30:00+05:30"},
                },
                {
                    "id": 107,
                    "name": "so2 ug/m3",
                    "parameter": {"id": 9, "name": "so2", "units": "µg/m³", "displayName": "Sulfur Dioxide"},
                    "datetimeLast": {"utc": "2026-10-28T11:00:00Z", "local": "2026-10-28T16:30:00+05:30"},
                },
            ],
        }
    ],
}


def make_hourly_observations(count: int, start_time: datetime, value: float, interval_hours: int = 1, unit: str = "µg/m³"):
    """Generates synthetic test fixtures mimicking OpenAQ /sensors/{id}/hours responses."""
    results = []
    for i in range(count):
        t_from = start_time + timedelta(hours=i * interval_hours)
        t_to = t_from + timedelta(hours=interval_hours)
        results.append({
            "value": value,
            "period": {
                "label": "hour",
                "interval": "01:00:00",
                "datetimeFrom": {"utc": t_from.strftime("%Y-%m-%dT%H:%M:%SZ"), "local": t_from.isoformat()},
                "datetimeTo": {"utc": t_to.strftime("%Y-%m-%dT%H:%M:%SZ"), "local": t_to.isoformat()},
            },
            "coverage": {
                "expectedCount": 1,
                "observedCount": 1,
                "percentComplete": 100.0,
            },
        })
    return {"meta": {"name": "openaq-api", "found": count}, "results": results}


def test_assessment_missing_api_key():
    """Verify endpoint returns 503 with MISSING_API_KEY when no OpenAQ key is configured."""
    with patch.object(settings, "OPENAQ_API_KEY", None), patch("app.services.openaq.openaq_service.api_key", None):
        response = client.get("/api/air-quality/locations/8118/assessment?parameter=pm25")
        assert response.status_code == 503
        data = response.json()
        assert data["error_code"] == "MISSING_API_KEY"
        assert "explore.openaq.org/register" in data["instructions"]


@pytest.mark.anyio
async def test_assessment_pm25_above_reference():
    """
    Verify valid 24h above-reference PM2.5 evaluation:
    - 20 valid hourly observations (83.3% completeness >= 75%).
    - Mean concentration = 115.0 µg/m³ exceeds CPCB NAAQS 2009 limit of 60.0 µg/m³.
    - Status = above_reference with ratio ~1.92.
    - Verified mitigation advisories are populated.
    """
    obs_start = FIXED_NOW - timedelta(hours=24)
    mock_obs = make_hourly_observations(20, obs_start, value=115.0)

    async def mock_get(url, *args, **kwargs):
        if "/locations/8118" in url:
            return httpx.Response(200, json=MOCK_STATION_WITH_ALL_SENSORS)
        if "/sensors/101/hours" in url:
            return httpx.Response(200, json=mock_obs)
        return httpx.Response(404)

    with patch.object(settings, "OPENAQ_API_KEY", "test-key"), patch("app.services.openaq.openaq_service.api_key", "test-key"):
        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get(f"/api/air-quality/locations/8118/assessment?parameter=pm25&reference_time={REF_ISO}")
            assert response.status_code == 200
            data = response.json()

            assert data["parameter"] == "pm25"
            assert data["averaging_period_hours"] == 24
            assert data["averaging_period_label"] == "24-hour"
            assert data["valid_observations"] == 20
            assert data["expected_observations"] == 24
            assert data["completeness_percentage"] == 83.3
            assert data["is_completeness_satisfied"] is True
            assert data["calculated_average"] == 115.0
            assert data["standard_threshold"] == 60.0
            assert data["ratio_to_standard"] == 1.92
            assert data["status"] == "above_reference"
            assert data["status_label"] == "Above reference level"
            assert data["freshness_state"] == "fresh"

            # Check secondary benchmark (WHO 2021: 15 µg/m³)
            assert data["secondary_benchmark_name"] == "WHO AQG (2021)"
            assert data["secondary_benchmark_threshold"] == 15.0

            # Verify practical mitigation advisories
            assert len(data["advisories"]) >= 2
            categories = [a["category"] for a in data["advisories"]]
            assert "Fleet & Logistics" in categories
            assert "Ventilation Maintenance" in categories
            for adv in data["advisories"]:
                assert "action" in adv
                assert "rationale" in adv
                assert "uncertainty" in adv


@pytest.mark.anyio
async def test_assessment_pm25_below_reference():
    """
    Verify valid 24h below-reference PM2.5 evaluation:
    - 22 valid hourly observations (91.7% completeness >= 75%).
    - Mean concentration = 42.5 µg/m³ is within CPCB NAAQS 2009 limit of 60.0 µg/m³.
    - Status = below_reference, ratio = 0.71.
    - Advisories list is empty.
    """
    obs_start = FIXED_NOW - timedelta(hours=24)
    mock_obs = make_hourly_observations(22, obs_start, value=42.5)

    async def mock_get(url, *args, **kwargs):
        if "/locations/8118" in url:
            return httpx.Response(200, json=MOCK_STATION_WITH_ALL_SENSORS)
        if "/sensors/101/hours" in url:
            return httpx.Response(200, json=mock_obs)
        return httpx.Response(404)

    with patch.object(settings, "OPENAQ_API_KEY", "test-key"), patch("app.services.openaq.openaq_service.api_key", "test-key"):
        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get(f"/api/air-quality/locations/8118/assessment?parameter=pm25&reference_time={REF_ISO}")
            assert response.status_code == 200
            data = response.json()

            assert data["status"] == "below_reference"
            assert data["status_label"] == "Below reference level"
            assert data["calculated_average"] == 42.5
            assert data["ratio_to_standard"] == 0.71
            assert data["advisories"] == []


@pytest.mark.anyio
async def test_assessment_insufficient_hourly_coverage():
    """
    Verify conservative completeness gate:
    - Only 12 of 24 hourly observations present (50% completeness < 75%).
    - System MUST NOT calculate a valid-looking average (calculated_average is None).
    - Status = insufficient_data, advisories suppressed.
    """
    obs_start = FIXED_NOW - timedelta(hours=24)
    mock_obs = make_hourly_observations(12, obs_start, value=150.0)

    async def mock_get(url, *args, **kwargs):
        if "/locations/8118" in url:
            return httpx.Response(200, json=MOCK_STATION_WITH_ALL_SENSORS)
        if "/sensors/101/hours" in url:
            return httpx.Response(200, json=mock_obs)
        return httpx.Response(404)

    with patch.object(settings, "OPENAQ_API_KEY", "test-key"), patch("app.services.openaq.openaq_service.api_key", "test-key"):
        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get(f"/api/air-quality/locations/8118/assessment?parameter=pm25&reference_time={REF_ISO}")
            assert response.status_code == 200
            data = response.json()

            assert data["valid_observations"] == 12
            assert data["completeness_percentage"] == 50.0
            assert data["is_completeness_satisfied"] is False
            assert data["calculated_average"] is None
            assert data["status"] == "insufficient_data"
            assert data["status_label"] == "Insufficient data"
            assert data["advisories"] == []
            assert "at least 75% coverage" in data["screening_limitations"].lower()


@pytest.mark.anyio
async def test_assessment_negative_values_and_deduplication():
    """
    Verify invalid negative concentration values are excluded with quality warnings
    and duplicate timestamps are deduplicated.
    """
    obs_start = FIXED_NOW - timedelta(hours=24)
    base_obs = make_hourly_observations(20, obs_start, value=75.0)

    # Insert 2 invalid negative values
    base_obs["results"][0]["value"] = -999.0
    base_obs["results"][1]["value"] = -5.4

    # Insert a duplicate timestamp with lower coverage
    duplicate_item = dict(base_obs["results"][5])
    duplicate_item["coverage"] = {"percentComplete": 40.0}
    duplicate_item["value"] = 80.0
    base_obs["results"].append(duplicate_item)

    async def mock_get(url, *args, **kwargs):
        if "/locations/8118" in url:
            return httpx.Response(200, json=MOCK_STATION_WITH_ALL_SENSORS)
        if "/sensors/101/hours" in url:
            return httpx.Response(200, json=base_obs)
        return httpx.Response(404)

    with patch.object(settings, "OPENAQ_API_KEY", "test-key"), patch("app.services.openaq.openaq_service.api_key", "test-key"):
        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get(f"/api/air-quality/locations/8118/assessment?parameter=pm25&reference_time={REF_ISO}")
            assert response.status_code == 200
            data = response.json()

            assert data["excluded_observations"] == 2
            assert len(data["data_quality_warnings"]) > 0
            assert "negative concentration" in data["data_quality_warnings"][0].lower()
            # 20 points minus 2 negatives = 18 valid points (75% of 24)
            assert data["valid_observations"] == 18
            assert data["is_completeness_satisfied"] is True
            assert data["calculated_average"] == 75.0


@pytest.mark.anyio
async def test_assessment_stale_sensor():
    """
    Verify stale sensor (>24 hours old) suppresses real-time operational mitigation alerts.
    """
    stale_sensor_time = FIXED_NOW - timedelta(hours=36)
    obs_start = stale_sensor_time - timedelta(hours=24)
    mock_obs = make_hourly_observations(24, obs_start, value=140.0)

    stale_station = dict(MOCK_STATION_WITH_ALL_SENSORS)
    stale_station["results"] = [dict(MOCK_STATION_WITH_ALL_SENSORS["results"][0])]
    stale_station["results"][0]["sensors"] = [
        {
            "id": 101,
            "name": "pm25 ug/m3",
            "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
            "datetimeLast": {"utc": stale_sensor_time.strftime("%Y-%m-%dT%H:%M:%SZ"), "local": stale_sensor_time.isoformat()},
        }
    ]

    async def mock_get(url, *args, **kwargs):
        if "/locations/8118" in url:
            return httpx.Response(200, json=stale_station)
        if "/sensors/101/hours" in url:
            return httpx.Response(200, json={"meta": {"found": 0}, "results": []})
        return httpx.Response(404)

    with patch.object(settings, "OPENAQ_API_KEY", "test-key"), patch("app.services.openaq.openaq_service.api_key", "test-key"):
        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get(f"/api/air-quality/locations/8118/assessment?parameter=pm25&reference_time={REF_ISO}")
            assert response.status_code == 200
            data = response.json()

            assert data["freshness_state"] == "stale"
            assert data["status"] == "stale_data"
            assert data["status_label"] == "Stale data"
            assert data["calculated_average"] is None
            assert data["advisories"] == []


@pytest.mark.anyio
async def test_assessment_historical_sensor():
    """
    Verify historical sensor (>30 days inactive, e.g. Station 10487 ending in 2021)
    returns historical_data status and suppresses real-time alerts.
    """
    hist_time = datetime(2021, 9, 20, 13, 15, 0, tzinfo=timezone.utc)
    hist_station = dict(MOCK_STATION_WITH_ALL_SENSORS)
    hist_station["results"] = [dict(MOCK_STATION_WITH_ALL_SENSORS["results"][0])]
    hist_station["results"][0]["sensors"] = [
        {
            "id": 101,
            "name": "pm25 ug/m3",
            "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
            "datetimeLast": {"utc": hist_time.strftime("%Y-%m-%dT%H:%M:%SZ"), "local": hist_time.isoformat()},
        }
    ]

    async def mock_get(url, *args, **kwargs):
        if "/locations/8118" in url:
            return httpx.Response(200, json=hist_station)
        if "/sensors/101/hours" in url:
            return httpx.Response(200, json={"meta": {"found": 0}, "results": []})
        return httpx.Response(404)

    with patch.object(settings, "OPENAQ_API_KEY", "test-key"), patch("app.services.openaq.openaq_service.api_key", "test-key"):
        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get(f"/api/air-quality/locations/8118/assessment?parameter=pm25&reference_time={REF_ISO}")
            assert response.status_code == 200
            data = response.json()

            assert data["freshness_state"] == "historical"
            assert data["status"] == "historical_data"
            assert data["status_label"] == "Historical data"
            assert data["calculated_average"] is None
            assert data["advisories"] == []


@pytest.mark.anyio
async def test_assessment_co_8h_window_and_averaging_period():
    """
    Verify CO evaluates over an 8-hour rolling window against CPCB NAAQS 2009 (2.0 mg/m³).
    Verify WHO 2021 24h CO guideline (4.0 mg/m³) is NOT evaluated against the 8h average.
    """
    obs_start = FIXED_NOW - timedelta(hours=8)
    mock_obs = make_hourly_observations(7, obs_start, value=2.8, unit="mg/m³")

    async def mock_get(url, *args, **kwargs):
        if "/locations/8118" in url:
            return httpx.Response(200, json=MOCK_STATION_WITH_ALL_SENSORS)
        if "/sensors/105/hours" in url:
            return httpx.Response(200, json=mock_obs)
        return httpx.Response(404)

    with patch.object(settings, "OPENAQ_API_KEY", "test-key"), patch("app.services.openaq.openaq_service.api_key", "test-key"):
        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get(f"/api/air-quality/locations/8118/assessment?parameter=co&sensor_id=105&reference_time={REF_ISO}")
            assert response.status_code == 200
            data = response.json()

            assert data["parameter"] == "co"
            assert data["averaging_period_hours"] == 8
            assert data["averaging_period_label"] == "8-hour"
            assert data["valid_observations"] == 7
            assert data["expected_observations"] == 8
            assert data["is_completeness_satisfied"] is True
            assert data["calculated_average"] == 2.8
            assert data["standard_threshold"] == 2.0
            assert data["ratio_to_standard"] == 1.4
            assert data["status"] == "above_reference"

            # Check WHO notes: WHO CO 24h standard must not be compared to 8h average
            assert data["secondary_benchmark_threshold"] is None
            assert "24-hour averaging period" in data["secondary_benchmark_notes"]


@pytest.mark.anyio
async def test_assessment_co_incompatible_ppm_unit():
    """
    Verify CO in ppm returns unsupported_parameter without guessing temperature/pressure.
    """
    ppm_station = {
        "meta": {"name": "openaq-api", "page": 1, "limit": 1, "found": 1},
        "results": [
            {
                "id": 8118,
                "name": "Anand Vihar, Delhi - DPCC",
                "locality": "Delhi",
                "timezone": "Asia/Kolkata",
                "country": {"id": 1, "code": "IN", "name": "India"},
                "provider": {"id": 1, "name": "CPCB"},
                "isMonitor": True,
                "datetimeLast": {"utc": "2026-10-28T11:00:00Z", "local": "2026-10-28T16:30:00+05:30"},
                "sensors": [
                    {
                        "id": 106,
                        "name": "co ppm",
                        "parameter": {"id": 8, "name": "co", "units": "ppm", "displayName": "Carbon Monoxide"},
                        "datetimeLast": {"utc": "2026-10-28T11:00:00Z", "local": "2026-10-28T16:30:00+05:30"},
                    }
                ],
            }
        ],
    }

    async def mock_get(url, *args, **kwargs):
        if "/locations/8118" in url:
            return httpx.Response(200, json=ppm_station)
        return httpx.Response(404)

    with patch.object(settings, "OPENAQ_API_KEY", "test-key"), patch("app.services.openaq.openaq_service.api_key", "test-key"):
        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get(f"/api/air-quality/locations/8118/assessment?parameter=co&sensor_id=106&reference_time={REF_ISO}")
            assert response.status_code == 200
            data = response.json()

            assert data["status"] == "unsupported_parameter"
            assert data["status_label"] == "Unsupported parameter unit"
            assert data["calculated_average"] is None
            assert "ppm" in data["screening_limitations"]
            assert "temperature" in data["screening_limitations"].lower()


@pytest.mark.anyio
async def test_assessment_ozone_8h_window():
    """
    Verify Ozone evaluates over an 8-hour rolling window against CPCB NAAQS (100 µg/m³).
    """
    obs_start = FIXED_NOW - timedelta(hours=8)
    mock_obs = make_hourly_observations(7, obs_start, value=120.0)

    async def mock_get(url, *args, **kwargs):
        if "/locations/8118" in url:
            return httpx.Response(200, json=MOCK_STATION_WITH_ALL_SENSORS)
        if "/sensors/104/hours" in url:
            return httpx.Response(200, json=mock_obs)
        return httpx.Response(404)

    with patch.object(settings, "OPENAQ_API_KEY", "test-key"), patch("app.services.openaq.openaq_service.api_key", "test-key"):
        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get(f"/api/air-quality/locations/8118/assessment?parameter=o3&sensor_id=104&reference_time={REF_ISO}")
            assert response.status_code == 200
            data = response.json()

            assert data["parameter"] == "o3"
            assert data["averaging_period_hours"] == 8
            assert data["standard_threshold"] == 100.0
            assert data["calculated_average"] == 120.0
            assert data["status"] == "above_reference"


@pytest.mark.anyio
async def test_assessment_sensor_timestamp_differs_from_station_timestamp():
    """
    Verify freshness is evaluated strictly against the sensor's own timestamp,
    not the station's timestamp.
    """
    station_data = dict(MOCK_STATION_WITH_ALL_SENSORS)
    station_data["results"] = [dict(MOCK_STATION_WITH_ALL_SENSORS["results"][0])]
    station_data["results"][0]["datetimeLast"] = {"utc": (FIXED_NOW - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")}
    station_data["results"][0]["sensors"][0]["datetimeLast"] = {
        "utc": (FIXED_NOW - timedelta(hours=30)).strftime("%Y-%m-%dT%H:%M:%SZ")
    }

    async def mock_get(url, *args, **kwargs):
        if "/locations/8118" in url:
            return httpx.Response(200, json=station_data)
        if "/sensors/101/hours" in url:
            return httpx.Response(200, json={"meta": {"found": 0}, "results": []})
        return httpx.Response(404)

    with patch.object(settings, "OPENAQ_API_KEY", "test-key"), patch("app.services.openaq.openaq_service.api_key", "test-key"):
        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get(f"/api/air-quality/locations/8118/assessment?parameter=pm25&reference_time={REF_ISO}")
            assert response.status_code == 200
            data = response.json()

            assert data["freshness_state"] == "stale"
            assert data["status"] == "stale_data"


@pytest.mark.anyio
async def test_assessment_missing_sensor():
    """Verify requesting an unmonitored parameter returns unavailable assessment cleanly."""
    async def mock_get(url, *args, **kwargs):
        if "/locations/8118" in url:
            return httpx.Response(200, json=MOCK_STATION_WITH_ALL_SENSORS)
        return httpx.Response(404)

    with patch.object(settings, "OPENAQ_API_KEY", "test-key"), patch("app.services.openaq.openaq_service.api_key", "test-key"):
        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get("/api/air-quality/locations/8118/assessment?parameter=bc")
            assert response.status_code == 200
            data = response.json()
            assert data["status"] == "unavailable"
            assert data["calculated_average"] is None
            assert data["advisories"] == []


@pytest.mark.anyio
async def test_assessment_upstream_timeout_error():
    """Verify upstream timeout during assessment returns structured 504."""
    async def mock_get(url, *args, **kwargs):
        if "/locations/8118" in url:
            return httpx.Response(200, json=MOCK_STATION_WITH_ALL_SENSORS)
        if "/sensors/101/hours" in url:
            raise httpx.TimeoutException("Upstream connection timed out")
        return httpx.Response(404)

    with patch.object(settings, "OPENAQ_API_KEY", "test-key"), patch("app.services.openaq.openaq_service.api_key", "test-key"):
        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get("/api/air-quality/locations/8118/assessment?parameter=pm25")
            assert response.status_code == 504
            data = response.json()
            assert data["error_code"] == "UPSTREAM_TIMEOUT"


@pytest.mark.anyio
async def test_assessment_no2_incompatible_ppm_unit():
    """
    Verify NO2 in ppm returns unsupported_parameter without guessing temperature/pressure.
    """
    no2_ppm_station = {
        "meta": {"name": "openaq-api", "page": 1, "limit": 1, "found": 1},
        "results": [
            {
                "id": 8118,
                "name": "Anand Vihar, Delhi - DPCC",
                "locality": "Delhi",
                "timezone": "Asia/Kolkata",
                "country": {"id": 1, "code": "IN", "name": "India"},
                "provider": {"id": 1, "name": "CPCB"},
                "isMonitor": True,
                "datetimeLast": {"utc": "2026-10-28T11:00:00Z", "local": "2026-10-28T16:30:00+05:30"},
                "sensors": [
                    {
                        "id": 108,
                        "name": "no2 ppm",
                        "parameter": {"id": 7, "name": "no2", "units": "ppm", "displayName": "NO₂"},
                        "datetimeLast": {"utc": "2026-10-28T11:00:00Z", "local": "2026-10-28T16:30:00+05:30"},
                    }
                ],
            }
        ],
    }

    async def mock_get(url, *args, **kwargs):
        if "/locations/8118" in url:
            return httpx.Response(200, json=no2_ppm_station)
        return httpx.Response(404)

    with patch.object(settings, "OPENAQ_API_KEY", "test-key"), patch("app.services.openaq.openaq_service.api_key", "test-key"):
        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get(f"/api/air-quality/locations/8118/assessment?parameter=no2&sensor_id=108&reference_time={REF_ISO}")
            assert response.status_code == 200
            data = response.json()

            assert data["status"] == "unsupported_parameter"
            assert data["status_label"] == "Unsupported parameter unit"
            assert data["calculated_average"] is None
            assert "ppm" in data["screening_limitations"]
            assert "temperature" in data["screening_limitations"].lower()


@pytest.mark.anyio
async def test_assessment_so2_incompatible_ppb_unit():
    """
    Verify SO2 in ppb returns unsupported_parameter without unverified conversion assumptions.
    """
    so2_ppb_station = {
        "meta": {"name": "openaq-api", "page": 1, "limit": 1, "found": 1},
        "results": [
            {
                "id": 8118,
                "name": "Anand Vihar, Delhi - DPCC",
                "locality": "Delhi",
                "timezone": "Asia/Kolkata",
                "country": {"id": 1, "code": "IN", "name": "India"},
                "provider": {"id": 1, "name": "CPCB"},
                "isMonitor": True,
                "datetimeLast": {"utc": "2026-10-28T11:00:00Z", "local": "2026-10-28T16:30:00+05:30"},
                "sensors": [
                    {
                        "id": 109,
                        "name": "so2 ppb",
                        "parameter": {"id": 9, "name": "so2", "units": "ppb", "displayName": "Sulfur Dioxide"},
                        "datetimeLast": {"utc": "2026-10-28T11:00:00Z", "local": "2026-10-28T16:30:00+05:30"},
                    }
                ],
            }
        ],
    }

    async def mock_get(url, *args, **kwargs):
        if "/locations/8118" in url:
            return httpx.Response(200, json=so2_ppb_station)
        return httpx.Response(404)

    with patch.object(settings, "OPENAQ_API_KEY", "test-key"), patch("app.services.openaq.openaq_service.api_key", "test-key"):
        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get(f"/api/air-quality/locations/8118/assessment?parameter=so2&sensor_id=109&reference_time={REF_ISO}")
            assert response.status_code == 200
            data = response.json()

            assert data["status"] == "unsupported_parameter"
            assert data["status_label"] == "Unsupported parameter unit"
            assert data["calculated_average"] is None
            assert "ppb" in data["screening_limitations"]


@pytest.mark.anyio
async def test_assessment_pm10_above_reference():
    """
    Verify PM10 evaluates over a 24-hour window against CPCB NAAQS (100.0 µg/m³).
    """
    obs_start = FIXED_NOW - timedelta(hours=24)
    mock_obs = make_hourly_observations(22, obs_start, value=145.0)

    async def mock_get(url, *args, **kwargs):
        if "/locations/8118" in url:
            return httpx.Response(200, json=MOCK_STATION_WITH_ALL_SENSORS)
        if "/sensors/102/hours" in url:
            return httpx.Response(200, json=mock_obs)
        return httpx.Response(404)

    with patch.object(settings, "OPENAQ_API_KEY", "test-key"), patch("app.services.openaq.openaq_service.api_key", "test-key"):
        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get(f"/api/air-quality/locations/8118/assessment?parameter=pm10&sensor_id=102&reference_time={REF_ISO}")
            assert response.status_code == 200
            data = response.json()

            assert data["parameter"] == "pm10"
            assert data["averaging_period_hours"] == 24
            assert data["standard_threshold"] == 100.0
            assert data["calculated_average"] == 145.0
            assert data["ratio_to_standard"] == 1.45
            assert data["status"] == "above_reference"
            assert len(data["advisories"]) > 0


@pytest.mark.anyio
async def test_assessment_no2_above_reference():
    """
    Verify NO2 evaluates over a 24-hour window against CPCB NAAQS (80.0 µg/m³).
    """
    obs_start = FIXED_NOW - timedelta(hours=24)
    mock_obs = make_hourly_observations(20, obs_start, value=95.0)

    async def mock_get(url, *args, **kwargs):
        if "/locations/8118" in url:
            return httpx.Response(200, json=MOCK_STATION_WITH_ALL_SENSORS)
        if "/sensors/103/hours" in url:
            return httpx.Response(200, json=mock_obs)
        return httpx.Response(404)

    with patch.object(settings, "OPENAQ_API_KEY", "test-key"), patch("app.services.openaq.openaq_service.api_key", "test-key"):
        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get(f"/api/air-quality/locations/8118/assessment?parameter=no2&sensor_id=103&reference_time={REF_ISO}")
            assert response.status_code == 200
            data = response.json()

            assert data["parameter"] == "no2"
            assert data["standard_threshold"] == 80.0
            assert data["calculated_average"] == 95.0
            assert data["ratio_to_standard"] == 1.19
            assert data["status"] == "above_reference"


@pytest.mark.anyio
async def test_assessment_so2_below_reference():
    """
    Verify SO2 evaluates over a 24-hour window against CPCB NAAQS (80.0 µg/m³).
    """
    obs_start = FIXED_NOW - timedelta(hours=24)
    mock_obs = make_hourly_observations(22, obs_start, value=35.0)

    async def mock_get(url, *args, **kwargs):
        if "/locations/8118" in url:
            return httpx.Response(200, json=MOCK_STATION_WITH_ALL_SENSORS)
        if "/sensors/107/hours" in url:
            return httpx.Response(200, json=mock_obs)
        return httpx.Response(404)

    with patch.object(settings, "OPENAQ_API_KEY", "test-key"), patch("app.services.openaq.openaq_service.api_key", "test-key"):
        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get(f"/api/air-quality/locations/8118/assessment?parameter=so2&sensor_id=107&reference_time={REF_ISO}")
            assert response.status_code == 200
            data = response.json()

            assert data["parameter"] == "so2"
            assert data["standard_threshold"] == 80.0
            assert data["calculated_average"] == 35.0
            assert data["ratio_to_standard"] == 0.44
            assert data["status"] == "below_reference"
            assert data["advisories"] == []


@pytest.mark.anyio
async def test_assessment_completeness_capped_at_100_percent():
    """
    Verify completeness percentage is strictly capped at 100.0% even when extra
    overlapping hourly points (e.g. 25 points in 24h) are returned.
    """
    obs_start = FIXED_NOW - timedelta(hours=24)
    # Generate 25 points by stepping every 58 minutes
    results = []
    for i in range(25):
        t_from = obs_start + timedelta(minutes=i * 57)
        t_to = t_from + timedelta(minutes=57)
        results.append({
            "value": 55.0,
            "period": {
                "label": "hour",
                "interval": "01:00:00",
                "datetimeFrom": {"utc": t_from.strftime("%Y-%m-%dT%H:%M:%SZ"), "local": t_from.isoformat()},
                "datetimeTo": {"utc": t_to.strftime("%Y-%m-%dT%H:%M:%SZ"), "local": t_to.isoformat()},
            },
            "coverage": {"percentComplete": 100.0},
        })
    mock_25_obs = {"meta": {"name": "openaq-api", "found": 25}, "results": results}

    async def mock_get(url, *args, **kwargs):
        if "/locations/8118" in url:
            return httpx.Response(200, json=MOCK_STATION_WITH_ALL_SENSORS)
        if "/sensors/101/hours" in url:
            return httpx.Response(200, json=mock_25_obs)
        return httpx.Response(404)

    with patch.object(settings, "OPENAQ_API_KEY", "test-key"), patch("app.services.openaq.openaq_service.api_key", "test-key"):
        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get(f"/api/air-quality/locations/8118/assessment?parameter=pm25&reference_time={REF_ISO}")
            assert response.status_code == 200
            data = response.json()

            assert data["valid_observations"] == 25
            assert data["expected_observations"] == 24
            assert data["completeness_percentage"] == 100.0
            assert data["is_completeness_satisfied"] is True


@pytest.mark.anyio
async def test_assessment_historical_reference_time_evaluation():
    """
    Verify historical window evaluation synchronizes with reference_time:
    - Sensor ceased reporting in 2021.
    - Query provides reference_time matching the sensor's historical active period.
    - Evaluates 24-hour historical window and calculates average.
    - Operational mitigation alerts are strictly suppressed for historical data.
    """
    hist_time = datetime(2021, 9, 20, 13, 0, 0, tzinfo=timezone.utc)
    hist_iso = hist_time.strftime("%Y-%m-%dT%H:%M:%SZ")

    hist_station = dict(MOCK_STATION_WITH_ALL_SENSORS)
    hist_station["results"] = [dict(MOCK_STATION_WITH_ALL_SENSORS["results"][0])]
    hist_station["results"][0]["sensors"] = [
        {
            "id": 101,
            "name": "pm25 ug/m3",
            "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
            "datetimeLast": {"utc": hist_iso, "local": hist_time.isoformat()},
        }
    ]

    obs_start = hist_time - timedelta(hours=24)
    mock_obs = make_hourly_observations(20, obs_start, value=112.0)

    async def mock_get(url, *args, **kwargs):
        if "/locations/8118" in url:
            return httpx.Response(200, json=hist_station)
        if "/sensors/101/hours" in url:
            return httpx.Response(200, json=mock_obs)
        return httpx.Response(404)

    with patch.object(settings, "OPENAQ_API_KEY", "test-key"), patch("app.services.openaq.openaq_service.api_key", "test-key"):
        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get(f"/api/air-quality/locations/8118/assessment?parameter=pm25&reference_time={hist_iso}")
            assert response.status_code == 200
            data = response.json()

            assert data["valid_observations"] == 20
            assert data["is_completeness_satisfied"] is True
            assert data["calculated_average"] == 112.0
            assert data["ratio_to_standard"] == 1.87
            assert data["freshness_state"] == "historical"
            assert data["status"] == "historical_data"
            assert data["status_label"] == "Historical sensor data"
            assert data["advisories"] == []
            assert len(data["advisories"]) == 0
            assert "retrospective evaluation" in data["screening_limitations"].lower()
            assert "suppressed" in data["screening_limitations"].lower()


def test_calculate_idling_abatement_canonical_values():
    """
    Verify canonical abatement calculations for default scenario (10 vehicles, 2 hours):
    - Fuel saved: 20.0 L
    - CO2 avoided: 53.6 kg
    - NOx avoided: 0.676 kg (676.0 g)
    - PM2.5 avoided: 22.0 g
    """
    res = calculate_idling_abatement(vehicles=10, hours=2.0)
    assert res.vehicles == 10
    assert res.hours == 2.0
    assert res.total_vehicle_hours == 20.0
    assert res.avoided_fuel_liters == 20.0
    assert res.avoided_co2_kg == 53.6
    assert res.avoided_nox_kg == 0.676
    assert res.avoided_nox_grams == 676.0
    assert res.avoided_pm25_grams == 22.0


def test_calculate_idling_abatement_boundaries():
    """
    Verify boundary inputs for calculation:
    - Minimum bound: 1 vehicle, 0.5 hours
    - Maximum bound: 200 vehicles, 12.0 hours
    """
    min_res = calculate_idling_abatement(vehicles=1, hours=0.5)
    assert min_res.vehicles == 1
    assert min_res.hours == 0.5
    assert min_res.total_vehicle_hours == 0.5
    assert min_res.avoided_fuel_liters == 0.5
    assert min_res.avoided_co2_kg == 1.34
    assert min_res.avoided_nox_kg == 0.017
    assert min_res.avoided_nox_grams == 16.9
    assert min_res.avoided_pm25_grams == 0.55

    max_res = calculate_idling_abatement(vehicles=200, hours=12.0)
    assert max_res.vehicles == 200
    assert max_res.hours == 12.0
    assert max_res.total_vehicle_hours == 2400.0
    assert max_res.avoided_fuel_liters == 2400.0
    assert max_res.avoided_co2_kg == 6432.0
    assert max_res.avoided_nox_kg == 81.12
    assert max_res.avoided_nox_grams == 81120.0
    assert max_res.avoided_pm25_grams == 2640.0


def test_calculate_idling_abatement_rejection():
    """
    Verify that out-of-bounds vehicles or hours raise ValueError without silent clamping.
    """
    # Vehicles below 1
    with pytest.raises(ValueError, match="between 1 and 200"):
        calculate_idling_abatement(vehicles=0, hours=2.0)

    # Vehicles above 200
    with pytest.raises(ValueError, match="between 1 and 200"):
        calculate_idling_abatement(vehicles=201, hours=2.0)

    # Hours below 0.5
    with pytest.raises(ValueError, match="between 0.5 and 12.0"):
        calculate_idling_abatement(vehicles=10, hours=0.4)

    # Hours above 12.0
    with pytest.raises(ValueError, match="between 0.5 and 12.0"):
        calculate_idling_abatement(vehicles=10, hours=12.1)

    # Invalid vehicle type (e.g. float or bool)
    with pytest.raises(ValueError, match="between 1 and 200"):
        calculate_idling_abatement(vehicles=True, hours=2.0)  # bool is subclass of int in python


def test_abatement_estimate_endpoint_success():
    """
    Verify GET /api/air-quality/abatement/estimate returns canonical calculations and metadata.
    """
    response = client.get("/api/air-quality/abatement/estimate?vehicles=15&hours=2.5")
    assert response.status_code == 200
    data = response.json()

    assert data["vehicles"] == 15
    assert data["hours"] == 2.5
    assert data["total_vehicle_hours"] == 37.5
    assert data["avoided_fuel_liters"] == 37.5
    assert data["avoided_co2_kg"] == 100.5
    assert data["avoided_nox_kg"] == 1.268
    assert data["avoided_nox_grams"] == 1267.5
    assert data["avoided_pm25_grams"] == 41.25

    # Factors provenance check
    factors = {f["metric"]: f for f in data["factors"]}
    assert "Fuel Consumption" in factors
    assert "CRRI" in factors["Fuel Consumption"]["provenance"]
    assert "Carbon Dioxide (CO2)" in factors
    assert "IPCC" in factors["Carbon Dioxide (CO2)"]["provenance"]
    assert "Nitrogen Oxides (NOx)" in factors
    assert "US EPA" in factors["Nitrogen Oxides (NOx)"]["provenance"]
    assert "NOT an in-use Indian tailpipe measurement" in factors["Nitrogen Oxides (NOx)"]["provenance"]
    assert "Fine Particulate Matter (PM2.5)" in factors
    assert "US EPA" in factors["Fine Particulate Matter (PM2.5)"]["provenance"]

    # Dust guidance check
    dust = data["dust_guidance"]
    assert dust["control_efficiency_range"] == "50%–70%"
    assert "unpaved-road surface watering" in dust["control_efficiency_scope"].lower()
    assert "PM10 mass avoided is N/A" in dust["mass_avoided_notice"]
    assert len(dust["supportive_controls"]) >= 4

    # Disclaimers check
    assert "hot-stabilized" in data["fleet_technology_caveat"].lower()
    assert "BS-VI" in data["fleet_technology_caveat"]
    assert "localized" in data["atmospheric_boundary_caveat"].lower()
    assert "not predict or guarantee an immediate measurable concentration reduction at distant" in data["atmospheric_boundary_caveat"]
    assert "not constitute a statutory compliance certificate" in data["statutory_disclaimer"].lower()


def test_abatement_estimate_endpoint_rejection_vehicles():
    """
    Verify rejection of out-of-range vehicles with HTTP 422 and meaningful error.
    """
    # vehicles = 0
    resp = client.get("/api/air-quality/abatement/estimate?vehicles=0&hours=2")
    assert resp.status_code == 422
    assert "between 1 and 200" in resp.json()["message"]

    # vehicles = 201
    resp2 = client.get("/api/air-quality/abatement/estimate?vehicles=201&hours=2")
    assert resp2.status_code == 422
    assert "between 1 and 200" in resp2.json()["message"]


def test_abatement_estimate_endpoint_rejection_hours():
    """
    Verify rejection of out-of-range hours with HTTP 422 and meaningful error.
    """
    # hours = 0.2
    resp = client.get("/api/air-quality/abatement/estimate?vehicles=10&hours=0.2")
    assert resp.status_code == 422
    assert "between 0.5 and 12.0" in resp.json()["message"]

    # hours = 15.0
    resp2 = client.get("/api/air-quality/abatement/estimate?vehicles=10&hours=15.0")
    assert resp2.status_code == 422
    assert "between 0.5 and 12.0" in resp2.json()["message"]
