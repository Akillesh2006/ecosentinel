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
