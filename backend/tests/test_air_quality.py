import logging
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch
import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app

client = TestClient(app)

# ---------------------------------------------------------------------------
# Mock Fixtures based on actual OpenAQ API v3 Schemas
# ---------------------------------------------------------------------------

MOCK_INDIA_LOCATIONS_PAGE = {
    "meta": {"name": "openaq-api", "page": 1, "limit": 10, "found": 2},
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
            "datetimeLast": {"utc": "2026-10-26T12:00:00Z", "local": "2026-10-26T17:30:00+05:30"},
            "sensors": [
                {
                    "id": 101,
                    "name": "pm25 ug/m3",
                    "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                },
                {
                    "id": 102,
                    "name": "pm10 ug/m3",
                    "parameter": {"id": 1, "name": "pm10", "units": "µg/m³", "displayName": "PM10"},
                },
                {
                    "id": 103,
                    "name": "no2 ug/m3",
                    "parameter": {"id": 7, "name": "no2", "units": "µg/m³", "displayName": "NO₂"},
                },
            ],
        },
        {
            "id": 8120,
            "name": "Bandra, Mumbai - MPCB",
            "locality": "Mumbai",
            "timezone": "Asia/Kolkata",
            "country": {"id": 1, "code": "IN", "name": "India"},
            "owner": {"id": 2, "name": "Maharashtra Pollution Control Board"},
            "provider": {"id": 1, "name": "CPCB"},
            "isMobile": False,
            "isMonitor": True,
            "instruments": [{"id": 1, "name": "Government CAAQMS"}],
            "coordinates": {"latitude": 19.0596, "longitude": 72.8295},
            "licenses": [],
            "datetimeFirst": {"utc": "2019-01-01T00:00:00Z", "local": "2019-01-01T05:30:00+05:30"},
            "datetimeLast": {"utc": "2024-01-01T00:00:00Z", "local": "2024-01-01T05:30:00+05:30"},  # Stale data
            "sensors": [
                {
                    "id": 201,
                    "name": "pm25 ug/m3",
                    "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                }
            ],
        },
    ],
}

MOCK_ANAND_VIHAR_DETAIL = {
    "meta": {"name": "openaq-api", "page": 1, "limit": 1, "found": 1},
    "results": [MOCK_INDIA_LOCATIONS_PAGE["results"][0]],
}

MOCK_HOURLY_MEASUREMENTS = {
    "meta": {"name": "openaq-api", "page": 1, "limit": 1000, "found": 3},
    "results": [
        {
            "value": 112.4,
            "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
            "period": {
                "label": "hour",
                "interval": "01:00:00",
                "datetimeFrom": {"utc": "2026-10-26T09:00:00Z", "local": "2026-10-26T14:30:00+05:30"},
                "datetimeTo": {"utc": "2026-10-26T10:00:00Z", "local": "2026-10-26T15:30:00+05:30"},
            },
            "coverage": {
                "expectedCount": 1,
                "observedCount": 1,
                "percentComplete": 100.0,
            },
        },
        {
            "value": 128.7,
            "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
            "period": {
                "label": "hour",
                "interval": "01:00:00",
                "datetimeFrom": {"utc": "2026-10-26T10:00:00Z", "local": "2026-10-26T15:30:00+05:30"},
                "datetimeTo": {"utc": "2026-10-26T11:00:00Z", "local": "2026-10-26T16:30:00+05:30"},
            },
            "coverage": {
                "expectedCount": 1,
                "observedCount": 1,
                "percentComplete": 100.0,
            },
        },
        {
            "value": 145.2,
            "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
            "period": {
                "label": "hour",
                "interval": "01:00:00",
                "datetimeFrom": {"utc": "2026-10-26T11:00:00Z", "local": "2026-10-26T16:30:00+05:30"},
                "datetimeTo": {"utc": "2026-10-26T12:00:00Z", "local": "2026-10-26T17:30:00+05:30"},
            },
            "coverage": {
                "expectedCount": 1,
                "observedCount": 1,
                "percentComplete": 100.0,
            },
        },
    ],
}


# ---------------------------------------------------------------------------
# Test Cases
# ---------------------------------------------------------------------------

def test_provider_status_endpoint() -> None:
    """Verify that /api/air-quality/provider-status returns status without error."""
    response = client.get("/api/air-quality/provider-status")
    assert response.status_code == 200
    data = response.json()
    assert data["provider"] == "OpenAQ v3"
    assert "is_configured" in data
    assert "is_reachable" in data
    assert "key_instructions" in data


def test_locations_missing_api_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify 503 MISSING_API_KEY response when OPENAQ_API_KEY is unset."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", None)
    with patch("app.services.openaq.openaq_service.api_key", None):
        response = client.get("/api/air-quality/locations")
        assert response.status_code == 503
        data = response.json()
        assert data["error_code"] == "MISSING_API_KEY"
        assert "instructions" in data
        assert "explore.openaq.org/register" in data["instructions"]


@pytest.mark.anyio
async def test_locations_success_with_mock(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify successful parsing of Indian monitoring locations from OpenAQ mock."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_valid_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_valid_key"):
        mock_resp = AsyncMock(spec=httpx.Response)
        mock_resp.is_success = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = MOCK_INDIA_LOCATIONS_PAGE

        with patch("httpx.AsyncClient.get", return_value=mock_resp):
            response = client.get("/api/air-quality/locations?country=IN")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2

            # Check Anand Vihar location normalization
            delhi = data[0]
            assert delhi["id"] == 8118
            assert "Anand Vihar" in delhi["name"]
            assert delhi["locality"] == "Delhi"
            assert delhi["country_code"] == "IN"
            assert delhi["provider_name"] == "CPCB"
            assert delhi["coordinates"]["latitude"] == 28.6476
            assert delhi["coordinates"]["longitude"] == 77.3158
            assert "pm25" in delhi["available_parameters"]
            assert "pm10" in delhi["available_parameters"]
            assert delhi["is_monitor"] is True


def test_locations_search_filter(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify that search query filters stations by name or locality."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        mock_resp = AsyncMock(spec=httpx.Response)
        mock_resp.is_success = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = MOCK_INDIA_LOCATIONS_PAGE

        with patch("httpx.AsyncClient.get", return_value=mock_resp):
            # Search for Mumbai
            resp_mumbai = client.get("/api/air-quality/locations?search=Mumbai")
            assert resp_mumbai.status_code == 200
            mumbai_data = resp_mumbai.json()
            assert len(mumbai_data) == 1
            assert mumbai_data[0]["locality"] == "Mumbai"

            # Search with no match
            resp_none = client.get("/api/air-quality/locations?search=NonExistentCityXYZ")
            assert resp_none.status_code == 200
            assert len(resp_none.json()) == 0


def test_location_detail_success(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify detailed station metadata retrieval with attached sensors."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        mock_resp = AsyncMock(spec=httpx.Response)
        mock_resp.is_success = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = MOCK_ANAND_VIHAR_DETAIL

        with patch("httpx.AsyncClient.get", return_value=mock_resp):
            response = client.get("/api/air-quality/locations/8118")
            assert response.status_code == 200
            data = response.json()
            assert data["id"] == 8118
            assert data["name"] == "Anand Vihar, Delhi - DPCC"
            assert data["timezone"] == "Asia/Kolkata"
            assert len(data["sensors"]) == 3
            assert data["sensors"][0]["parameter_name"] == "pm25"
            assert data["sensors"][0]["units"] == "µg/m³"


def test_location_detail_not_found(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify 404 response when OpenAQ location does not exist."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        mock_resp = AsyncMock(spec=httpx.Response)
        mock_resp.is_success = False
        mock_resp.status_code = 404
        mock_resp.text = "Not Found"

        with patch("httpx.AsyncClient.get", return_value=mock_resp):
            response = client.get("/api/air-quality/locations/99999")
            assert response.status_code == 404
            data = response.json()
            assert data["error_code"] == "NOT_FOUND"


def test_measurements_success(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify historical time-series observation parsing with coverage calculations."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        # First call gets location detail (8118), second gets sensor hours
        loc_resp = AsyncMock(spec=httpx.Response)
        loc_resp.is_success = True
        loc_resp.status_code = 200
        loc_resp.json.return_value = MOCK_ANAND_VIHAR_DETAIL

        meas_resp = AsyncMock(spec=httpx.Response)
        meas_resp.is_success = True
        meas_resp.status_code = 200
        meas_resp.json.return_value = MOCK_HOURLY_MEASUREMENTS

        with patch("httpx.AsyncClient.get", side_effect=[loc_resp, meas_resp]):
            date_from = "2026-10-26T09:00:00Z"
            date_to = "2026-10-26T12:00:00Z"
            response = client.get(
                f"/api/air-quality/locations/8118/measurements?parameter=pm25&date_from={date_from}&date_to={date_to}"
            )
            assert response.status_code == 200
            data = response.json()
            assert data["location_id"] == 8118
            assert data["parameter"] == "pm25"
            assert data["units"] == "µg/m³"
            assert data["total_observations"] == 3
            assert data["expected_observations"] == 3
            assert data["missing_percentage"] == 0.0
            assert len(data["measurements"]) == 3
            assert data["measurements"][0]["value"] == 112.4
            assert data["measurements"][2]["value"] == 145.2
            assert "Concentration measurements reflect physical observations" in data["data_integrity_notice"]


def test_measurements_empty_period(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify that an empty measurement period returns 0 observations without fabricating data."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        loc_resp = AsyncMock(spec=httpx.Response)
        loc_resp.is_success = True
        loc_resp.status_code = 200
        loc_resp.json.return_value = MOCK_ANAND_VIHAR_DETAIL

        meas_resp = AsyncMock(spec=httpx.Response)
        meas_resp.is_success = True
        meas_resp.status_code = 200
        meas_resp.json.return_value = {"meta": {}, "results": []}

        with patch("httpx.AsyncClient.get", side_effect=[loc_resp, meas_resp]):
            response = client.get("/api/air-quality/locations/8118/measurements?parameter=pm25")
            assert response.status_code == 200
            data = response.json()
            assert data["total_observations"] == 0
            assert data["measurements"] == []


def test_measurements_invalid_date_range(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify 400 error when date_from is later than date_to."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        loc_resp = AsyncMock(spec=httpx.Response)
        loc_resp.is_success = True
        loc_resp.status_code = 200
        loc_resp.json.return_value = MOCK_ANAND_VIHAR_DETAIL

        with patch("httpx.AsyncClient.get", return_value=loc_resp):
            response = client.get(
                "/api/air-quality/locations/8118/measurements?parameter=pm25&date_from=2026-10-26T12:00:00Z&date_to=2026-10-26T10:00:00Z"
            )
            assert response.status_code == 400
            data = response.json()
            assert data["error_code"] == "INVALID_DATE_RANGE"


def test_measurements_excessive_date_range(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify 400 error when date range exceeds the 90-day bound."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        loc_resp = AsyncMock(spec=httpx.Response)
        loc_resp.is_success = True
        loc_resp.status_code = 200
        loc_resp.json.return_value = MOCK_ANAND_VIHAR_DETAIL

        with patch("httpx.AsyncClient.get", return_value=loc_resp):
            date_from = "2026-01-01T00:00:00Z"
            date_to = "2026-06-01T00:00:00Z"  # > 150 days
            response = client.get(
                f"/api/air-quality/locations/8118/measurements?parameter=pm25&date_from={date_from}&date_to={date_to}"
            )
            assert response.status_code == 400
            data = response.json()
            assert data["error_code"] == "EXCESSIVE_TIME_RANGE"


def test_measurements_unsupported_pollutant(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify 400 error when requesting a pollutant not monitored by station."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        loc_resp = AsyncMock(spec=httpx.Response)
        loc_resp.is_success = True
        loc_resp.status_code = 200
        loc_resp.json.return_value = MOCK_ANAND_VIHAR_DETAIL

        with patch("httpx.AsyncClient.get", return_value=loc_resp):
            response = client.get("/api/air-quality/locations/8118/measurements?parameter=unsupported_pollutant")
            assert response.status_code == 400
            data = response.json()
            assert data["error_code"] == "UNSUPPORTED_POLLUTANT"


def test_upstream_auth_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify 502 UPSTREAM_AUTH_ERROR when OpenAQ rejects the API key."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "invalid_key")
    with patch("app.services.openaq.openaq_service.api_key", "invalid_key"):
        mock_resp = AsyncMock(spec=httpx.Response)
        mock_resp.is_success = False
        mock_resp.status_code = 401
        mock_resp.text = '{"message": "Unauthorized"}'

        with patch("httpx.AsyncClient.get", return_value=mock_resp):
            response = client.get("/api/air-quality/locations")
            assert response.status_code == 502
            data = response.json()
            assert data["error_code"] == "UPSTREAM_AUTH_ERROR"


def test_upstream_rate_limiting(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify 429 RATE_LIMIT_EXCEEDED when OpenAQ throttles the client."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "valid_key")
    with patch("app.services.openaq.openaq_service.api_key", "valid_key"):
        mock_resp = AsyncMock(spec=httpx.Response)
        mock_resp.is_success = False
        mock_resp.status_code = 429
        mock_resp.text = '{"message": "Too Many Requests"}'

        with patch("httpx.AsyncClient.get", return_value=mock_resp):
            response = client.get("/api/air-quality/locations")
            assert response.status_code == 429
            data = response.json()
            assert data["error_code"] == "RATE_LIMIT_EXCEEDED"


def test_upstream_server_error(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify 502 UPSTREAM_SERVER_ERROR when OpenAQ returns 500 error."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "valid_key")
    with patch("app.services.openaq.openaq_service.api_key", "valid_key"):
        mock_resp = AsyncMock(spec=httpx.Response)
        mock_resp.is_success = False
        mock_resp.status_code = 500
        mock_resp.text = '{"message": "Internal Server Error"}'

        with patch("httpx.AsyncClient.get", return_value=mock_resp):
            response = client.get("/api/air-quality/locations")
            assert response.status_code == 502
            data = response.json()
            assert data["error_code"] == "UPSTREAM_SERVER_ERROR"


def test_upstream_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify 504 UPSTREAM_TIMEOUT when OpenAQ request times out."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "valid_key")
    with patch("app.services.openaq.openaq_service.api_key", "valid_key"):
        with patch("httpx.AsyncClient.get", side_effect=httpx.TimeoutException("Read timeout")):
            response = client.get("/api/air-quality/locations")
            assert response.status_code == 504
            data = response.json()
            assert data["error_code"] == "UPSTREAM_TIMEOUT"


def test_location_detail_null_licenses_and_instruments_regression(monkeypatch: pytest.MonkeyPatch) -> None:
    """Regression test: Ensure location detail parses when OpenAQ returns null for licenses/instruments."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        loc_data = {
            "meta": {"name": "openaq-api", "page": 1, "limit": 1, "found": 1},
            "results": [
                {
                    "id": 2586,
                    "name": "Manali, Chennai - CPCB",
                    "locality": None,
                    "timezone": "Asia/Kolkata",
                    "country": {"id": 1, "code": "IN", "name": "India"},
                    "owner": {"id": 1, "name": "CPCB"},
                    "provider": {"id": 1, "name": "CPCB"},
                    "isMobile": False,
                    "isMonitor": True,
                    "instruments": None,  # OpenAQ returns null
                    "licenses": None,     # OpenAQ returns null
                    "coordinates": {"latitude": 13.1678, "longitude": 80.2605},
                    "datetimeLast": {"utc": "2026-10-23T15:30:00Z", "local": "2026-10-23T21:00:00+05:30"},
                    "sensors": [
                        {"id": 14319, "name": "pm25", "parameter": {"id": 2, "name": "pm25", "units": "µg/m³"}},
                        {"id": 12235653, "name": "pm25", "parameter": {"id": 2, "name": "pm25", "units": "µg/m³"}},
                    ],
                }
            ],
        }
        mock_resp = AsyncMock(spec=httpx.Response)
        mock_resp.is_success = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = loc_data

        with patch("httpx.AsyncClient.get", return_value=mock_resp):
            response = client.get("/api/air-quality/locations/2586")
            assert response.status_code == 200
            data = response.json()
            assert data["name"] == "Manali, Chennai - CPCB"
            assert data["licenses"] == []
            assert data["instruments"] == []
            # Deduplicated: only the latest sensor (12235653) is kept
            assert len(data["sensors"]) == 1
            assert data["sensors"][0]["id"] == 12235653


def test_measurements_selects_active_sensor_when_duplicates_exist(monkeypatch: pytest.MonkeyPatch) -> None:
    """Regression test: Ensure measurements selects newest active sensor (highest ID) when duplicate sensors exist."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        loc_data = {
            "meta": {"name": "openaq-api", "page": 1, "limit": 1, "found": 1},
            "results": [
                {
                    "id": 2586,
                    "name": "Manali, Chennai - CPCB",
                    "provider": {"name": "CPCB"},
                    "sensors": [
                        {"id": 14319, "name": "pm25", "parameter": {"id": 2, "name": "pm25", "units": "µg/m³"}},
                        {"id": 12235653, "name": "pm25", "parameter": {"id": 2, "name": "pm25", "units": "µg/m³"}},
                    ],
                }
            ],
        }
        meas_data = {
            "meta": {"name": "openaq-api", "page": 1, "limit": 100, "found": 1},
            "results": [
                {
                    "value": 34.5,
                    "period": {
                        "label": "1hour",
                        "interval": "01:00:00",
                        "datetimeFrom": {"utc": "2026-10-23T14:30:00Z", "local": "2026-10-23T20:00:00+05:30"},
                        "datetimeTo": {"utc": "2026-10-23T15:30:00Z", "local": "2026-10-23T21:00:00+05:30"},
                    },
                    "coverage": {"percentComplete": 100.0},
                }
            ],
        }

        async def mock_get(url: str, *args, **kwargs):
            resp = AsyncMock(spec=httpx.Response)
            resp.is_success = True
            resp.status_code = 200
            if "locations/2586" in url:
                resp.json.return_value = loc_data
            elif "sensors/12235653" in url:
                resp.json.return_value = meas_data
            else:
                resp.json.return_value = {"results": []}
            return resp

        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get("/api/air-quality/locations/2586/measurements?parameter=pm25")
            assert response.status_code == 200
            data = response.json()
            assert data["sensor_id"] == 12235653
            assert data["total_observations"] == 1
            assert data["measurements"][0]["value"] == 34.5


def test_locations_chennai_geo_search(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify that searching for Chennai utilizes coordinates query to OpenAQ."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        captured_params = {}

        async def mock_get(url: str, *args, **kwargs):
            nonlocal captured_params
            captured_params = kwargs.get("params", {})
            resp = AsyncMock(spec=httpx.Response)
            resp.is_success = True
            resp.status_code = 200
            resp.json.return_value = {"results": []}
            return resp

        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get("/api/air-quality/locations?search=Chennai")
            assert response.status_code == 200
            assert "coordinates" in captured_params
            assert captured_params["radius"] == 25000


def test_locations_prioritize_active_stations_over_defunct_stations(monkeypatch: pytest.MonkeyPatch) -> None:
    """Regression test: verify locations are sorted by datetime_last_utc descending so active stations precede inactive 2018 stations."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        mock_raw = {
            "meta": {"name": "openaq-api", "page": 1, "limit": 10, "found": 2},
            "results": [
                {
                    "id": 13,
                    "name": "Delhi Technological University, Delhi - CPCB",
                    "locality": "Delhi",
                    "datetimeLast": {"utc": "2018-02-22T04:00:00Z", "local": "2018-02-22T09:30:00+05:30"},
                    "sensors": [{"id": 13864, "parameter": {"id": 2, "name": "pm25"}}],
                },
                {
                    "id": 235,
                    "name": "Anand Vihar, New Delhi - DPCC",
                    "locality": "Delhi",
                    "datetimeLast": {"utc": "2026-10-23T15:30:00Z", "local": "2026-10-23T21:00:00+05:30"},
                    "sensors": [{"id": 12235610, "parameter": {"id": 2, "name": "pm25"}}],
                },
            ],
        }
        mock_resp = AsyncMock(spec=httpx.Response)
        mock_resp.is_success = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_raw

        with patch("httpx.AsyncClient.get", return_value=mock_resp):
            response = client.get("/api/air-quality/locations?search=Delhi")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 2
            # Active station must appear first in list
            assert data[0]["id"] == 235
            assert data[0]["name"] == "Anand Vihar, New Delhi - DPCC"
            assert data[1]["id"] == 13
            assert data[1]["name"] == "Delhi Technological University, Delhi - CPCB"


def test_measurements_returns_sensor_datetime_last(monkeypatch: pytest.MonkeyPatch) -> None:
    """Regression test: verify LocationMeasurementsResponse includes sensor_datetime_last_utc and sensor_datetime_last_local."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        loc_resp = AsyncMock(spec=httpx.Response)
        loc_resp.is_success = True
        loc_resp.status_code = 200
        loc_resp.json.return_value = {
            "results": [
                {
                    "id": 13,
                    "name": "Delhi Technological University, Delhi - CPCB",
                    "datetimeLast": {"utc": "2018-02-22T04:00:00Z", "local": "2018-02-22T09:30:00+05:30"},
                    "sensors": [
                        {
                            "id": 13864,
                            "parameter": {"id": 2, "name": "pm25", "units": "µg/m³"},
                            "datetimeLast": {"utc": "2018-02-22T04:00:00Z", "local": "2018-02-22T09:30:00+05:30"},
                        }
                    ],
                }
            ]
        }

        meas_resp = AsyncMock(spec=httpx.Response)
        meas_resp.is_success = True
        meas_resp.status_code = 200
        meas_resp.json.return_value = {"results": []}

        with patch("httpx.AsyncClient.get", side_effect=[loc_resp, meas_resp]):
            response = client.get("/api/air-quality/locations/13/measurements?parameter=pm25")
            assert response.status_code == 200
            data = response.json()
            assert data["total_observations"] == 0
            assert data["sensor_id"] == 13864
            assert data["sensor_datetime_last_utc"] == "2018-02-22T04:00:00Z"
            assert data["sensor_datetime_last_local"] == "2018-02-22T09:30:00+05:30"
            assert data["is_stale"] is True
            assert "Last observation" in data["stale_message"]


def test_measurements_missing_hourly_records(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify missing hourly observations calculation: expected count accounts for window without inventing zero measurements."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        loc_resp = AsyncMock(spec=httpx.Response)
        loc_resp.is_success = True
        loc_resp.status_code = 200
        loc_resp.json.return_value = MOCK_ANAND_VIHAR_DETAIL

        # Simulate 18 records returned across a 24-hour historical window (6 missing hours)
        results = []
        for i in range(18):
            hour = i
            results.append({
                "value": 50.0 + i,
                "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                "period": {
                    "label": "hour",
                    "interval": "01:00:00",
                    "datetimeFrom": {"utc": f"2026-10-25T{hour:02d}:00:00Z", "local": f"2026-10-25T{hour:02d}:30:00+05:30"},
                    "datetimeTo": {"utc": f"2026-10-25T{hour+1:02d}:00:00Z", "local": f"2026-10-25T{hour+1:02d}:30:00+05:30"},
                },
                "coverage": {"percentComplete": 100.0},
            })

        meas_resp = AsyncMock(spec=httpx.Response)
        meas_resp.is_success = True
        meas_resp.status_code = 200
        meas_resp.json.return_value = {"results": results}

        with patch("httpx.AsyncClient.get", side_effect=[loc_resp, meas_resp]):
            date_from = "2026-10-25T00:00:00Z"
            date_to = "2026-10-26T00:00:00Z"
            response = client.get(
                f"/api/air-quality/locations/8118/measurements?parameter=pm25&date_from={date_from}&date_to={date_to}"
            )
            assert response.status_code == 200
            data = response.json()
            assert data["expected_observations"] == 24
            assert data["total_observations"] == 18
            assert data["missing_percentage"] == 25.0  # (24 - 18) / 24 * 100 = 25.0%
            # Verify no missing points are fabricated as zero
            assert len(data["measurements"]) == 18
            for pt in data["measurements"]:
                assert pt["value"] > 0
                assert pt["is_missing"] is False


def test_measurements_duplicate_timestamps_handling(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify duplicate timestamps from upstream are deduplicated and do not inflate completeness."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        loc_resp = AsyncMock(spec=httpx.Response)
        loc_resp.is_success = True
        loc_resp.status_code = 200
        loc_resp.json.return_value = MOCK_ANAND_VIHAR_DETAIL

        # Upstream returns 4 records, but 2 have the exact same start timestamp (duplicate)
        duplicate_results = [
            {
                "value": 112.4,
                "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                "period": {
                    "label": "hour",
                    "interval": "01:00:00",
                    "datetimeFrom": {"utc": "2026-10-26T09:00:00Z", "local": "2026-10-26T14:30:00+05:30"},
                    "datetimeTo": {"utc": "2026-10-26T10:00:00Z", "local": "2026-10-26T15:30:00+05:30"},
                },
                "coverage": {"percentComplete": 100.0},
            },
            {
                # Duplicate with lower coverage
                "value": 112.0,
                "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                "period": {
                    "label": "hour",
                    "interval": "01:00:00",
                    "datetimeFrom": {"utc": "2026-10-26T10:00:00Z", "local": "2026-10-26T15:30:00+05:30"},
                    "datetimeTo": {"utc": "2026-10-26T11:00:00Z", "local": "2026-10-26T16:30:00+05:30"},
                },
                "coverage": {"percentComplete": 50.0},
            },
            {
                # Duplicate with higher coverage (100%)
                "value": 128.7,
                "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                "period": {
                    "label": "hour",
                    "interval": "01:00:00",
                    "datetimeFrom": {"utc": "2026-10-26T10:00:00Z", "local": "2026-10-26T15:30:00+05:30"},
                    "datetimeTo": {"utc": "2026-10-26T11:00:00Z", "local": "2026-10-26T16:30:00+05:30"},
                },
                "coverage": {"percentComplete": 100.0},
            },
            {
                "value": 145.2,
                "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                "period": {
                    "label": "hour",
                    "interval": "01:00:00",
                    "datetimeFrom": {"utc": "2026-10-26T11:00:00Z", "local": "2026-10-26T16:30:00+05:30"},
                    "datetimeTo": {"utc": "2026-10-26T12:00:00Z", "local": "2026-10-26T17:30:00+05:30"},
                },
                "coverage": {"percentComplete": 100.0},
            },
        ]

        meas_resp = AsyncMock(spec=httpx.Response)
        meas_resp.is_success = True
        meas_resp.status_code = 200
        meas_resp.json.return_value = {"results": duplicate_results}

        with patch("httpx.AsyncClient.get", side_effect=[loc_resp, meas_resp]):
            date_from = "2026-10-26T09:00:00Z"
            date_to = "2026-10-26T12:00:00Z"
            response = client.get(
                f"/api/air-quality/locations/8118/measurements?parameter=pm25&date_from={date_from}&date_to={date_to}"
            )
            assert response.status_code == 200
            data = response.json()
            # Deduplication preserves exactly 3 unique observations, not 4
            assert data["total_observations"] == 3
            assert len(data["measurements"]) == 3
            # The point with 100% coverage was retained over 50%
            pts_at_10 = [p for p in data["measurements"] if "10:00:00" in p["datetime_from_utc"]]
            assert len(pts_at_10) == 1
            assert pts_at_10[0]["value"] == 128.7
            assert pts_at_10[0]["percent_complete"] == 100.0
            # Data completeness correctly reflects 3/3 = 100% (0% missing)
            assert data["missing_percentage"] == 0.0


def test_measurements_incomplete_window_capped_at_current_time(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify that expected observation count caps at current time when date_to extends into future."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        loc_resp = AsyncMock(spec=httpx.Response)
        loc_resp.is_success = True
        loc_resp.status_code = 200
        loc_resp.json.return_value = MOCK_ANAND_VIHAR_DETAIL

        # Frozen now_utc = 2026-10-27T12:00:00Z
        fixed_now = datetime(2026, 10, 27, 12, 0, 0, tzinfo=timezone.utc)
        # Query window: 6 hours ago to 18 hours in the future (total 24 hours requested)
        date_from = "2026-10-27T06:00:00Z"
        date_to = "2026-10-28T06:00:00Z"

        # 6 observations received for the elapsed 6 hours
        results = []
        for h in range(6, 12):
            results.append({
                "value": 75.0,
                "parameter": {"id": 2, "name": "pm25", "units": "µg/m³"},
                "period": {
                    "label": "hour",
                    "interval": "01:00:00",
                    "datetimeFrom": {"utc": f"2026-10-27T{h:02d}:00:00Z", "local": f"2026-10-27T{h+5:02d}:30:00+05:30"},
                    "datetimeTo": {"utc": f"2026-10-27T{h+1:02d}:00:00Z", "local": f"2026-10-27T{h+6:02d}:30:00+05:30"},
                },
                "coverage": {"percentComplete": 100.0},
            })

        meas_resp = AsyncMock(spec=httpx.Response)
        meas_resp.is_success = True
        meas_resp.status_code = 200
        meas_resp.json.return_value = {"results": results}

        with patch("app.services.openaq.datetime") as mock_dt, patch("httpx.AsyncClient.get", side_effect=[loc_resp, meas_resp]):
            mock_dt.now.return_value = fixed_now
            mock_dt.fromisoformat = datetime.fromisoformat
            mock_dt.min = datetime.min

            response = client.get(
                f"/api/air-quality/locations/8118/measurements?parameter=pm25&date_from={date_from}&date_to={date_to}"
            )
            assert response.status_code == 200
            data = response.json()
            # Expected count must be 6 (elapsed hours up to now), NOT 24 (which includes future hours)
            assert data["expected_observations"] == 6
            assert data["total_observations"] == 6
            assert data["missing_percentage"] == 0.0


def test_measurements_stale_sensor_independent_of_station_freshness(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify data freshness is calculated from the selected pollutant sensor, not station-wide timestamp."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        fixed_now = datetime(2026, 10, 27, 12, 0, 0, tzinfo=timezone.utc)
        # Station datetimeLast is fresh (10 minutes ago, e.g. from an active ozone sensor)
        # But PM2.5 sensor datetimeLast is 5 days ago (stale!)
        station_detail = {
            "results": [
                {
                    "id": 8118,
                    "name": "Anand Vihar, Delhi - DPCC",
                    "datetimeLast": {"utc": "2026-10-27T11:50:00Z", "local": "2026-10-27T17:20:00+05:30"},
                    "sensors": [
                        {
                            "id": 101,
                            "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                            "datetimeLast": {"utc": "2026-10-22T10:00:00Z", "local": "2026-10-22T15:30:00+05:30"},
                        },
                        {
                            "id": 104,
                            "parameter": {"id": 10, "name": "o3", "units": "µg/m³", "displayName": "Ozone"},
                            "datetimeLast": {"utc": "2026-10-27T11:50:00Z", "local": "2026-10-27T17:20:00+05:30"},
                        },
                    ],
                }
            ]
        }

        loc_resp = AsyncMock(spec=httpx.Response)
        loc_resp.is_success = True
        loc_resp.status_code = 200
        loc_resp.json.return_value = station_detail

        meas_resp = AsyncMock(spec=httpx.Response)
        meas_resp.is_success = True
        meas_resp.status_code = 200
        meas_resp.json.return_value = {"results": []}

        with patch("app.services.openaq.datetime") as mock_dt, patch("httpx.AsyncClient.get", side_effect=[loc_resp, meas_resp]):
            mock_dt.now.return_value = fixed_now
            mock_dt.fromisoformat = datetime.fromisoformat
            mock_dt.min = datetime.min

            # Query PM2.5 (which stopped reporting 5 days ago)
            response = client.get("/api/air-quality/locations/8118/measurements?parameter=pm25")
            assert response.status_code == 200
            data = response.json()
            # Must be flagged as stale because PM2.5 sensor is stale, even though station timestamp is fresh!
            assert data["is_stale"] is True
            assert data["sensor_datetime_last_utc"] == "2026-10-22T10:00:00Z"
            assert "Last observation" in data["stale_message"]
            assert "5d" in data["stale_message"]


def test_measurements_sensor_sampling_interval_15_minutes(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify expected observation count properly accounts for 15-minute sensor sampling interval."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        loc_resp = AsyncMock(spec=httpx.Response)
        loc_resp.is_success = True
        loc_resp.status_code = 200
        loc_resp.json.return_value = MOCK_ANAND_VIHAR_DETAIL

        # 2-hour window with 15-minute intervals -> expects 8 observations
        results = [
            {
                "value": 42.0,
                "parameter": {"id": 2, "name": "pm25", "units": "µg/m³"},
                "period": {
                    "label": "15min",
                    "interval": "00:15:00",
                    "datetimeFrom": {"utc": "2026-10-25T10:00:00Z"},
                    "datetimeTo": {"utc": "2026-10-25T10:15:00Z"},
                },
            },
            {
                "value": 44.5,
                "parameter": {"id": 2, "name": "pm25", "units": "µg/m³"},
                "period": {
                    "label": "15min",
                    "interval": "00:15:00",
                    "datetimeFrom": {"utc": "2026-10-25T10:15:00Z"},
                    "datetimeTo": {"utc": "2026-10-25T10:30:00Z"},
                },
            },
        ]

        meas_resp = AsyncMock(spec=httpx.Response)
        meas_resp.is_success = True
        meas_resp.status_code = 200
        meas_resp.json.return_value = {"results": results}

        with patch("httpx.AsyncClient.get", side_effect=[loc_resp, meas_resp]):
            date_from = "2026-10-25T10:00:00Z"
            date_to = "2026-10-25T12:00:00Z"
            response = client.get(
                f"/api/air-quality/locations/8118/measurements?parameter=pm25&date_from={date_from}&date_to={date_to}"
            )
            assert response.status_code == 200
            data = response.json()
            # 2 hours / 15 minutes = 8 expected observations
            assert data["expected_observations"] == 8
            assert data["total_observations"] == 2
            # 2/8 = 25% complete -> 75% missing
            assert data["missing_percentage"] == 75.0


def test_measurements_utc_to_local_fallback(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify UTC-to-local conversion fallback when upstream OpenAQ omits local timestamp fields."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        loc_resp = AsyncMock(spec=httpx.Response)
        loc_resp.is_success = True
        loc_resp.status_code = 200
        loc_resp.json.return_value = MOCK_ANAND_VIHAR_DETAIL

        # Upstream results omit "local" key completely
        results = [
            {
                "value": 88.0,
                "parameter": {"id": 2, "name": "pm25", "units": "µg/m³"},
                "period": {
                    "label": "hour",
                    "interval": "01:00:00",
                    "datetimeFrom": {"utc": "2026-10-26T10:00:00Z"},
                    "datetimeTo": {"utc": "2026-10-26T11:00:00Z"},
                },
            }
        ]

        meas_resp = AsyncMock(spec=httpx.Response)
        meas_resp.is_success = True
        meas_resp.status_code = 200
        meas_resp.json.return_value = {"results": results}

        with patch("httpx.AsyncClient.get", side_effect=[loc_resp, meas_resp]):
            response = client.get("/api/air-quality/locations/8118/measurements?parameter=pm25")
            assert response.status_code == 200
            data = response.json()
            pt = data["measurements"][0]
            # Must be converted to local IST time (+05:30)
            assert pt["datetime_from_local"] is not None
            assert "+05:30" in pt["datetime_from_local"]
            assert "15:30:00" in pt["datetime_from_local"]
            assert pt["datetime_to_local"] is not None
            assert "+05:30" in pt["datetime_to_local"]
            assert "16:30:00" in pt["datetime_to_local"]


def test_measurements_oct20_hourly_period_window_mapping(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify that October 20 hourly records (e.g. PM2.5 = 10.5) preserve both start and end boundaries.
    
    Demonstrates that OpenAQ Explorer's '20:00 IST' is datetime_to_local (period end) while
    EcoSentinel's '19:00 IST' is datetime_from_local (period start), resolving the apparent discrepancy.
    """
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        loc_resp = AsyncMock(spec=httpx.Response)
        loc_resp.is_success = True
        loc_resp.status_code = 200
        loc_resp.json.return_value = MOCK_ANAND_VIHAR_DETAIL

        oct20_results = [
            {
                "value": 10.5,
                "parameter": {"id": 2, "name": "pm25", "units": "µg/m³"},
                "period": {
                    "label": "1hour",
                    "interval": "01:00:00",
                    "datetimeFrom": {
                        "utc": "2026-10-20T13:30:00Z",
                        "local": "2026-10-20T19:00:00+05:30",
                    },
                    "datetimeTo": {
                        "utc": "2026-10-20T14:30:00Z",
                        "local": "2026-10-20T20:00:00+05:30",
                    },
                },
                "coverage": {"percentComplete": 75.0},
            }
        ]

        meas_resp = AsyncMock(spec=httpx.Response)
        meas_resp.is_success = True
        meas_resp.status_code = 200
        meas_resp.json.return_value = {"results": oct20_results}

        with patch("httpx.AsyncClient.get", side_effect=[loc_resp, meas_resp]):
            response = client.get("/api/air-quality/locations/8118/measurements?parameter=pm25")
            assert response.status_code == 200
            data = response.json()
            pt = data["measurements"][0]

            assert pt["value"] == 10.5
            # UTC window boundaries
            assert pt["datetime_from_utc"] == "2026-10-20T13:30:00Z"
            assert pt["datetime_to_utc"] == "2026-10-20T14:30:00Z"
            # Local window boundaries (Start: 19:00 IST, End: 20:00 IST)
            assert pt["datetime_from_local"] == "2026-10-20T19:00:00+05:30"
            assert pt["datetime_to_local"] == "2026-10-20T20:00:00+05:30"
            # Coverage percentage preserved
            assert pt["percent_complete"] == 75.0


# ---------------------------------------------------------------------------
# Milestone 2: Station Search Matching & Bounded Pagination Regression Tests
# ---------------------------------------------------------------------------


def test_locations_search_anand_vihar_delhi_matches_new_delhi_station(monkeypatch: pytest.MonkeyPatch) -> None:
    """Case 1: Verify that searching for 'Anand Vihar, Delhi' matches 'Anand Vihar, New Delhi - DPCC'."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        mock_raw = {
            "meta": {"name": "openaq-api", "page": 1, "limit": 100, "found": 1},
            "results": [
                {
                    "id": 235,
                    "name": "Anand Vihar, New Delhi - DPCC",
                    "locality": "Delhi",
                    "country": {"id": 1, "code": "IN", "name": "India"},
                    "provider": {"name": "DPCC"},
                    "datetimeLast": {"utc": "2026-10-26T12:00:00Z", "local": "2026-10-26T17:30:00+05:30"},
                    "sensors": [{"id": 101, "parameter": {"id": 2, "name": "pm25"}}],
                }
            ],
        }
        mock_resp = AsyncMock(spec=httpx.Response)
        mock_resp.is_success = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_raw

        with patch("httpx.AsyncClient.get", return_value=mock_resp):
            response = client.get("/api/air-quality/locations?search=Anand+Vihar%2C+Delhi")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["id"] == 235
            assert data[0]["name"] == "Anand Vihar, New Delhi - DPCC"


def test_locations_search_punctuation_and_whitespace_insensitivity(monkeypatch: pytest.MonkeyPatch) -> None:
    """Case 2: Verify that punctuation differences and repeated whitespace do not cause false negatives."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        mock_raw = {
            "meta": {"name": "openaq-api", "page": 1, "limit": 100, "found": 1},
            "results": [
                {
                    "id": 235,
                    "name": "Anand Vihar, New Delhi - DPCC",
                    "locality": "Delhi",
                    "provider": {"name": "DPCC"},
                    "datetimeLast": {"utc": "2026-10-26T12:00:00Z"},
                    "sensors": [{"id": 101, "parameter": {"id": 2, "name": "pm25"}}],
                }
            ],
        }
        mock_resp = AsyncMock(spec=httpx.Response)
        mock_resp.is_success = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_raw

        with patch("httpx.AsyncClient.get", return_value=mock_resp):
            for q in ["Anand Vihar Delhi", "Anand   Vihar", "Anand-Vihar, DPCC", "Anand/Vihar.Delhi"]:
                resp = client.get(f"/api/air-quality/locations?search={q}")
                assert resp.status_code == 200
                data = resp.json()
                assert len(data) == 1, f"Failed matching query: {q!r}"
                assert data[0]["id"] == 235


def test_locations_search_token_order_independent(monkeypatch: pytest.MonkeyPatch) -> None:
    """Case 3: Verify that token ordering does not matter as long as all tokens match."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        mock_raw = {
            "meta": {"name": "openaq-api", "page": 1, "limit": 100, "found": 1},
            "results": [
                {
                    "id": 235,
                    "name": "Anand Vihar, New Delhi - DPCC",
                    "locality": "Delhi",
                    "provider": {"name": "DPCC"},
                    "datetimeLast": {"utc": "2026-10-26T12:00:00Z"},
                    "sensors": [{"id": 101, "parameter": {"id": 2, "name": "pm25"}}],
                }
            ],
        }
        mock_resp = AsyncMock(spec=httpx.Response)
        mock_resp.is_success = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_raw

        with patch("httpx.AsyncClient.get", return_value=mock_resp):
            for q in ["Delhi Anand Vihar", "DPCC Anand Vihar", "Vihar DPCC Anand"]:
                resp = client.get(f"/api/air-quality/locations?search={q}")
                assert resp.status_code == 200
                data = resp.json()
                assert len(data) == 1, f"Failed matching query: {q!r}"
                assert data[0]["id"] == 235


def test_locations_search_requires_all_tokens(monkeypatch: pytest.MonkeyPatch) -> None:
    """Case 4: Verify that all meaningful query tokens must match; partial multi-token matches are rejected."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        mock_raw = {
            "meta": {"name": "openaq-api", "page": 1, "limit": 100, "found": 1},
            "results": [
                {
                    "id": 235,
                    "name": "Anand Vihar, New Delhi - DPCC",
                    "locality": "Delhi",
                    "provider": {"name": "DPCC"},
                    "datetimeLast": {"utc": "2026-10-26T12:00:00Z"},
                    "sensors": [{"id": 101, "parameter": {"id": 2, "name": "pm25"}}],
                }
            ],
        }
        mock_resp = AsyncMock(spec=httpx.Response)
        mock_resp.is_success = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_raw

        with patch("httpx.AsyncClient.get", return_value=mock_resp):
            # 'Anand Vihar Mumbai' has 'Anand' and 'Vihar', but 'Mumbai' is absent
            resp = client.get("/api/air-quality/locations?search=Anand+Vihar+Mumbai")
            assert resp.status_code == 200
            assert len(resp.json()) == 0

            # 'Delhi Kolkata' has 'Delhi', but 'Kolkata' is absent
            resp2 = client.get("/api/air-quality/locations?search=Delhi+Kolkata")
            assert resp2.status_code == 200
            assert len(resp2.json()) == 0


def test_locations_paginated_discovery_finds_page_2_station(monkeypatch: pytest.MonkeyPatch) -> None:
    """Case 5: Verify that multi-page discovery fetches page 2 and finds a matching station when page 1 has unrelated records."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        page1_results = [
            {
                "id": 1000 + i,
                "name": f"Station {i}, Mumbai - MPCB",
                "locality": "Mumbai",
                "provider": {"name": "MPCB"},
                "datetimeLast": {"utc": "2026-10-25T00:00:00Z"},
                "sensors": [],
            }
            for i in range(100)
        ]
        page2_results = [
            {
                "id": 235,
                "name": "Anand Vihar, New Delhi - DPCC",
                "locality": "Delhi",
                "provider": {"name": "DPCC"},
                "datetimeLast": {"utc": "2026-10-26T12:00:00Z"},
                "sensors": [{"id": 101, "parameter": {"id": 2, "name": "pm25"}}],
            }
        ]

        async def mock_get(url: str, *args, **kwargs):
            params = kwargs.get("params", {})
            current_page = params.get("page", 1)
            resp = AsyncMock(spec=httpx.Response)
            resp.is_success = True
            resp.status_code = 200
            if current_page == 1:
                resp.json.return_value = {
                    "meta": {"page": 1, "limit": 100, "found": 101},
                    "results": page1_results,
                }
            elif current_page == 2:
                resp.json.return_value = {
                    "meta": {"page": 2, "limit": 100, "found": 101},
                    "results": page2_results,
                }
            else:
                resp.json.return_value = {
                    "meta": {"page": current_page, "limit": 100, "found": 101},
                    "results": [],
                }
            return resp

        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get("/api/air-quality/locations?search=Anand+Vihar")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 1
            assert data[0]["id"] == 235
            assert data[0]["name"] == "Anand Vihar, New Delhi - DPCC"


def test_locations_deduplicate_across_pages(monkeypatch: pytest.MonkeyPatch) -> None:
    """Case 6: Verify that stations with identical IDs across pages produce only one returned station."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        station = {
            "id": 235,
            "name": "Anand Vihar, New Delhi - DPCC",
            "locality": "Delhi",
            "provider": {"name": "DPCC"},
            "datetimeLast": {"utc": "2026-10-26T12:00:00Z"},
            "sensors": [],
        }

        async def mock_get(url: str, *args, **kwargs):
            resp = AsyncMock(spec=httpx.Response)
            resp.is_success = True
            resp.status_code = 200
            page_results = [dict(station)] + [
                {"id": 9000 + i, "name": f"Other {i}", "locality": "Delhi", "sensors": []}
                for i in range(99)
            ]
            resp.json.return_value = {
                "meta": {"page": 1, "limit": 100, "found": 200},
                "results": page_results,
            }
            return resp

        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get("/api/air-quality/locations?search=Anand+Vihar")
            assert response.status_code == 200
            data = response.json()
            anand_matches = [s for s in data if s["id"] == 235]
            assert len(anand_matches) == 1


def test_locations_pagination_stops_on_short_page(monkeypatch: pytest.MonkeyPatch) -> None:
    """Case 7: Verify that pagination terminates immediately when a page returns fewer items than limit."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        call_count = 0

        async def mock_get(url: str, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            resp = AsyncMock(spec=httpx.Response)
            resp.is_success = True
            resp.status_code = 200
            resp.json.return_value = {
                "meta": {"page": 1, "limit": 100, "found": 5},
                "results": [
                    {"id": 10 + i, "name": f"Station {i}, Delhi", "locality": "Delhi", "sensors": []}
                    for i in range(5)
                ],
            }
            return resp

        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get("/api/air-quality/locations?search=Delhi")
            assert response.status_code == 200
            assert call_count == 1
            assert len(response.json()) == 5


def test_locations_pagination_stops_when_meta_found_reached(monkeypatch: pytest.MonkeyPatch) -> None:
    """Case 8: Verify that pagination stops when current_page * limit >= meta.found."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        call_count = 0

        async def mock_get(url: str, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            resp = AsyncMock(spec=httpx.Response)
            resp.is_success = True
            resp.status_code = 200
            resp.json.return_value = {
                "meta": {"page": 1, "limit": 100, "found": 100},
                "results": [
                    {"id": 100 + i, "name": f"Station {i}, Delhi", "locality": "Delhi", "sensors": []}
                    for i in range(100)
                ],
            }
            return resp

        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get("/api/air-quality/locations?search=Delhi")
            assert response.status_code == 200
            assert call_count == 1
            assert len(response.json()) == 100


def test_locations_pagination_handles_malformed_meta(monkeypatch: pytest.MonkeyPatch) -> None:
    """Case 9: Verify that non-numeric, string (e.g. '> 100'), or null meta.found does not crash search."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        for malformed_meta in [None, {}, {"found": "> 100"}, {"found": "invalid"}, {"found": None}]:
            async def mock_get(url: str, *args, **kwargs):
                resp = AsyncMock(spec=httpx.Response)
                resp.is_success = True
                resp.status_code = 200
                resp.json.return_value = {
                    "meta": malformed_meta,
                    "results": [
                        {"id": 1, "name": "Anand Vihar, Delhi", "locality": "Delhi", "sensors": []}
                    ],
                }
                return resp

            with patch("httpx.AsyncClient.get", side_effect=mock_get):
                response = client.get("/api/air-quality/locations?search=Anand+Vihar")
                assert response.status_code == 200
                data = response.json()
                assert len(data) == 1
                assert data[0]["id"] == 1


def test_locations_pagination_strict_three_page_budget(monkeypatch: pytest.MonkeyPatch) -> None:
    """Case 10: Verify that pagination never makes more than 3 page requests even if upstream has thousands of records."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        call_count = 0

        async def mock_get(url: str, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            resp = AsyncMock(spec=httpx.Response)
            resp.is_success = True
            resp.status_code = 200
            resp.json.return_value = {
                "meta": {"page": call_count, "limit": 100, "found": 10000},
                "results": [
                    {"id": call_count * 1000 + i, "name": f"Station {call_count}_{i}", "locality": "Delhi", "sensors": []}
                    for i in range(100)
                ],
            }
            return resp

        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get("/api/air-quality/locations?search=Station")
            assert response.status_code == 200
            assert call_count == 3


def test_locations_pagination_later_page_failure_preserves_earlier_results(monkeypatch: pytest.MonkeyPatch) -> None:
    """Case 11: Verify that if page 1 succeeds and page 2 times out or returns HTTP 500, page 1 results are returned."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        call_count = 0

        async def mock_get(url: str, *args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                resp = AsyncMock(spec=httpx.Response)
                resp.is_success = True
                resp.status_code = 200
                resp.json.return_value = {
                    "meta": {"page": 1, "limit": 100, "found": 200},
                    "results": [
                        {"id": 235, "name": "Anand Vihar, New Delhi - DPCC", "locality": "Delhi", "sensors": []}
                    ] + [{"id": 500 + i, "name": f"Other {i}", "locality": "Delhi", "sensors": []} for i in range(99)],
                }
                return resp
            else:
                raise httpx.TimeoutException("Upstream timeout on page 2")

        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get("/api/air-quality/locations?search=Anand+Vihar")
            assert response.status_code == 200
            data = response.json()
            assert any(s["id"] == 235 for s in data)


def test_locations_first_page_failure_propagates_error(monkeypatch: pytest.MonkeyPatch) -> None:
    """Case 12: Verify that if page 1 encounters an upstream error or timeout, the error is properly raised."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        # Timeout on page 1
        with patch("httpx.AsyncClient.get", side_effect=httpx.TimeoutException("Timeout on page 1")):
            resp = client.get("/api/air-quality/locations?search=Delhi")
            assert resp.status_code == 504
            assert resp.json()["error_code"] == "UPSTREAM_TIMEOUT"

        # 429 on page 1
        mock_429 = AsyncMock(spec=httpx.Response)
        mock_429.is_success = False
        mock_429.status_code = 429
        mock_429.text = "Too Many Requests"
        with patch("httpx.AsyncClient.get", return_value=mock_429):
            resp = client.get("/api/air-quality/locations?search=Delhi")
            assert resp.status_code == 429
            assert resp.json()["error_code"] == "RATE_LIMIT_EXCEEDED"


def test_locations_result_limit_respected(monkeypatch: pytest.MonkeyPatch) -> None:
    """Case 13: Verify that the returned stations count respects the limit parameter."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        mock_raw = {
            "meta": {"name": "openaq-api", "page": 1, "limit": 100, "found": 50},
            "results": [
                {"id": 100 + i, "name": f"Station {i}, Delhi", "locality": "Delhi", "sensors": []}
                for i in range(50)
            ],
        }
        mock_resp = AsyncMock(spec=httpx.Response)
        mock_resp.is_success = True
        mock_resp.status_code = 200
        mock_resp.json.return_value = mock_raw

        with patch("httpx.AsyncClient.get", return_value=mock_resp):
            response = client.get("/api/air-quality/locations?search=Delhi&limit=5")
            assert response.status_code == 200
            data = response.json()
            assert len(data) == 5


def test_measurements_resolves_sensor_datetime_last_when_location_sensor_lacks_timestamp(monkeypatch: pytest.MonkeyPatch) -> None:
    """Regression test: OpenAQ v3 /locations/{id} returns sensors with datetimeLast: None.

    When measurements request yields 0 observations for the current window, verify that:
    1. Sensor metadata is resolved via /sensors/{sensor_id}.
    2. sensor_datetime_last_utc/local are populated accurately.
    3. The stale message reports time since last observation rather than falsely claiming no history.
    4. The sensor's observation timestamp (05:45 UTC) is NOT conflated with the station's timestamp (07:45 UTC).
    """
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        station_detail = {
            "results": [
                {
                    "id": 10487,
                    "name": "Anand Vihar, Delhi - DPCC",
                    "locality": "Delhi",
                    "timezone": "Asia/Kolkata",
                    "datetimeLast": {"utc": "2021-09-20T07:45:00Z", "local": "2021-09-20T13:15:00+05:30"},
                    "sensors": [
                        {
                            "id": 34771,
                            "name": "pm25",
                            "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                            "datetimeFirst": None,
                            "datetimeLast": None,
                        }
                    ],
                }
            ]
        }

        sensor_detail = {
            "results": [
                {
                    "id": 34771,
                    "name": "pm25",
                    "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                    "datetimeFirst": {"utc": "2018-08-13T11:00:00Z", "local": "2018-08-13T16:30:00+05:30"},
                    "datetimeLast": {"utc": "2021-09-20T05:45:00Z", "local": "2021-09-20T11:15:00+05:30"},
                    "coverage": {"observedCount": 28050},
                }
            ]
        }

        async def mock_get(url: str, *args, **kwargs):
            resp = AsyncMock(spec=httpx.Response)
            resp.is_success = True
            resp.status_code = 200
            if "locations/10487" in url:
                resp.json.return_value = station_detail
            elif "sensors/34771/hours" in url:
                resp.json.return_value = {"results": []}
            elif "sensors/34771" in url:
                resp.json.return_value = sensor_detail
            else:
                resp.json.return_value = {"results": []}
            return resp

        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get("/api/air-quality/locations/10487/measurements?parameter=pm25")
            assert response.status_code == 200
            data = response.json()
            assert data["total_observations"] == 0
            assert data["sensor_id"] == 34771
            # Sensor's actual timestamp must be preserved (05:45 UTC, NOT station's 07:45 UTC)
            assert data["sensor_datetime_last_utc"] == "2021-09-20T05:45:00Z"
            assert data["sensor_datetime_last_local"] == "2021-09-20T11:15:00+05:30"
            assert data["is_stale"] is True
            assert "Last observation was recorded" in data["stale_message"]
            assert "No observation history available" not in data["stale_message"]


def test_measurements_sensor_truly_without_observations_reports_no_history(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify that a sensor truly lacking any recorded observations reports no observation history."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        station_detail = {
            "results": [
                {
                    "id": 10487,
                    "name": "Anand Vihar, Delhi - DPCC",
                    "locality": "Delhi",
                    "timezone": "Asia/Kolkata",
                    "datetimeLast": None,
                    "sensors": [
                        {
                            "id": 99999,
                            "name": "pm25",
                            "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                            "datetimeFirst": None,
                            "datetimeLast": None,
                        }
                    ],
                }
            ]
        }

        sensor_detail = {
            "results": [
                {
                    "id": 99999,
                    "name": "pm25",
                    "datetimeFirst": None,
                    "datetimeLast": None,
                    "coverage": {"observedCount": 0},
                }
            ]
        }

        async def mock_get(url: str, *args, **kwargs):
            resp = AsyncMock(spec=httpx.Response)
            resp.is_success = True
            resp.status_code = 200
            if "locations/10487" in url:
                resp.json.return_value = station_detail
            elif "sensors/99999/hours" in url:
                resp.json.return_value = {"results": []}
            elif "sensors/99999" in url:
                resp.json.return_value = sensor_detail
            else:
                resp.json.return_value = {"results": []}
            return resp

        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get("/api/air-quality/locations/10487/measurements?parameter=pm25")
            assert response.status_code == 200
            data = response.json()
            assert data["total_observations"] == 0
            assert data["sensor_datetime_last_utc"] is None
            assert data["is_stale"] is True
            assert data["stale_message"] == "No observation history available for PM2.5 sensor."


def test_measurements_historical_window_retrieves_observations(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify that specifying a historical date window retrieves past observations and does not present them as current."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "mock_key")
    with patch("app.services.openaq.openaq_service.api_key", "mock_key"):
        station_detail = {
            "results": [
                {
                    "id": 10487,
                    "name": "Anand Vihar, Delhi - DPCC",
                    "locality": "Delhi",
                    "timezone": "Asia/Kolkata",
                    "sensors": [
                        {
                            "id": 34771,
                            "name": "pm25",
                            "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                        }
                    ],
                }
            ]
        }

        historical_hours = {
            "results": [
                {
                    "value": 45.0,
                    "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                    "period": {
                        "label": "hour",
                        "interval": "01:00:00",
                        "datetimeFrom": {"utc": "2021-09-20T04:00:00Z", "local": "2021-09-20T09:30:00+05:30"},
                        "datetimeTo": {"utc": "2021-09-20T05:00:00Z", "local": "2021-09-20T10:30:00+05:30"},
                    },
                    "coverage": {"percentComplete": 100.0},
                }
            ]
        }

        async def mock_get(url: str, *args, **kwargs):
            resp = AsyncMock(spec=httpx.Response)
            resp.is_success = True
            resp.status_code = 200
            if "locations/10487" in url:
                resp.json.return_value = station_detail
            elif "sensors/34771/hours" in url:
                resp.json.return_value = historical_hours
            return resp

        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get(
                "/api/air-quality/locations/10487/measurements"
                "?parameter=pm25&date_from=2021-09-13T00:00:00Z&date_to=2021-09-20T06:00:00Z"
            )
            assert response.status_code == 200
            data = response.json()
            assert data["total_observations"] == 1
            assert data["measurements"][0]["value"] == 45.0
            # Must still be flagged as stale data, not presented as current
            assert data["is_stale"] is True
            assert "Last observation was recorded" in data["stale_message"]


def test_sensor_detail_upstream_http_error_falls_back_gracefully(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """Verify that upstream HTTP errors (e.g. 500) during sensor detail resolution fall back safely without raising."""
    secret_key = "super_secret_test_key_12345"
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", secret_key)
    with patch("app.services.openaq.openaq_service.api_key", secret_key):
        station_detail = {
            "results": [
                {
                    "id": 10487,
                    "name": "Anand Vihar, Delhi - DPCC",
                    "locality": "Delhi",
                    "timezone": "Asia/Kolkata",
                    "datetimeLast": {"utc": "2021-09-20T07:45:00Z", "local": "2021-09-20T13:15:00+05:30"},
                    "sensors": [
                        {
                            "id": 34771,
                            "name": "pm25",
                            "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                            "datetimeFirst": None,
                            "datetimeLast": None,
                        }
                    ],
                }
            ]
        }

        async def mock_get(url: str, *args, **kwargs):
            if "locations/10487" in url:
                resp = AsyncMock(spec=httpx.Response)
                resp.is_success = True
                resp.status_code = 200
                resp.json.return_value = station_detail
                return resp
            elif "sensors/34771/hours" in url:
                resp = AsyncMock(spec=httpx.Response)
                resp.is_success = True
                resp.status_code = 200
                resp.json.return_value = {"results": []}
                return resp
            elif "sensors/34771" in url:
                resp = AsyncMock(spec=httpx.Response)
                resp.is_success = False
                resp.status_code = 500
                resp.text = "Internal Server Error"
                return resp
            resp = AsyncMock(spec=httpx.Response)
            resp.is_success = True
            resp.status_code = 200
            resp.json.return_value = {"results": []}
            return resp

        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            with caplog.at_level(logging.WARNING):
                response = client.get("/api/air-quality/locations/10487/measurements?parameter=pm25")
            assert response.status_code == 200
            data = response.json()
            assert data["total_observations"] == 0
            assert data["sensor_datetime_last_utc"] is None
            assert data["is_stale"] is True
            assert data["stale_message"] == "No observation history available for PM2.5 sensor."
            # Verify logged warning contains useful context
            assert "Upstream error HTTP 500 retrieving metadata for sensor 34771" in caplog.text
            # Verify secrets are never exposed in logs
            assert secret_key not in caplog.text


def test_sensor_detail_upstream_timeout_falls_back_gracefully(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """Verify that timeout during sensor detail resolution falls back safely without failing measurement request."""
    secret_key = "super_secret_test_key_12345"
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", secret_key)
    with patch("app.services.openaq.openaq_service.api_key", secret_key):
        station_detail = {
            "results": [
                {
                    "id": 10487,
                    "name": "Anand Vihar, Delhi - DPCC",
                    "locality": "Delhi",
                    "timezone": "Asia/Kolkata",
                    "datetimeLast": {"utc": "2021-09-20T07:45:00Z", "local": "2021-09-20T13:15:00+05:30"},
                    "sensors": [
                        {
                            "id": 34771,
                            "name": "pm25",
                            "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                            "datetimeFirst": None,
                            "datetimeLast": None,
                        }
                    ],
                }
            ]
        }

        async def mock_get(url: str, *args, **kwargs):
            if "locations/10487" in url:
                resp = AsyncMock(spec=httpx.Response)
                resp.is_success = True
                resp.status_code = 200
                resp.json.return_value = station_detail
                return resp
            elif "sensors/34771/hours" in url:
                resp = AsyncMock(spec=httpx.Response)
                resp.is_success = True
                resp.status_code = 200
                resp.json.return_value = {"results": []}
                return resp
            elif "sensors/34771" in url:
                raise httpx.TimeoutException("Connection timed out")
            resp = AsyncMock(spec=httpx.Response)
            resp.is_success = True
            resp.status_code = 200
            resp.json.return_value = {"results": []}
            return resp

        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            with caplog.at_level(logging.WARNING):
                response = client.get("/api/air-quality/locations/10487/measurements?parameter=pm25")
            assert response.status_code == 200
            data = response.json()
            assert data["total_observations"] == 0
            assert data["sensor_datetime_last_utc"] is None
            assert data["is_stale"] is True
            assert "Timeout retrieving metadata for sensor 34771 from OpenAQ" in caplog.text
            assert secret_key not in caplog.text


def test_sensor_detail_network_error_falls_back_gracefully(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """Verify that network connection error during sensor detail resolution falls back safely."""
    secret_key = "super_secret_test_key_12345"
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", secret_key)
    with patch("app.services.openaq.openaq_service.api_key", secret_key):
        station_detail = {
            "results": [
                {
                    "id": 10487,
                    "name": "Anand Vihar, Delhi - DPCC",
                    "locality": "Delhi",
                    "timezone": "Asia/Kolkata",
                    "datetimeLast": {"utc": "2021-09-20T07:45:00Z", "local": "2021-09-20T13:15:00+05:30"},
                    "sensors": [
                        {
                            "id": 34771,
                            "name": "pm25",
                            "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                            "datetimeFirst": None,
                            "datetimeLast": None,
                        }
                    ],
                }
            ]
        }

        async def mock_get(url: str, *args, **kwargs):
            if "locations/10487" in url:
                resp = AsyncMock(spec=httpx.Response)
                resp.is_success = True
                resp.status_code = 200
                resp.json.return_value = station_detail
                return resp
            elif "sensors/34771/hours" in url:
                resp = AsyncMock(spec=httpx.Response)
                resp.is_success = True
                resp.status_code = 200
                resp.json.return_value = {"results": []}
                return resp
            elif "sensors/34771" in url:
                raise httpx.ConnectError("Failed to connect to host")
            resp = AsyncMock(spec=httpx.Response)
            resp.is_success = True
            resp.status_code = 200
            resp.json.return_value = {"results": []}
            return resp

        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            with caplog.at_level(logging.WARNING):
                response = client.get("/api/air-quality/locations/10487/measurements?parameter=pm25")
            assert response.status_code == 200
            data = response.json()
            assert data["total_observations"] == 0
            assert data["sensor_datetime_last_utc"] is None
            assert "Network error retrieving metadata for sensor 34771" in caplog.text
            assert secret_key not in caplog.text


def test_sensor_detail_malformed_json_falls_back_gracefully(
    monkeypatch: pytest.MonkeyPatch, caplog: pytest.LogCaptureFixture
) -> None:
    """Verify that malformed JSON response during sensor detail resolution falls back safely."""
    secret_key = "super_secret_test_key_12345"
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", secret_key)
    with patch("app.services.openaq.openaq_service.api_key", secret_key):
        station_detail = {
            "results": [
                {
                    "id": 10487,
                    "name": "Anand Vihar, Delhi - DPCC",
                    "locality": "Delhi",
                    "timezone": "Asia/Kolkata",
                    "datetimeLast": {"utc": "2021-09-20T07:45:00Z", "local": "2021-09-20T13:15:00+05:30"},
                    "sensors": [
                        {
                            "id": 34771,
                            "name": "pm25",
                            "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                            "datetimeFirst": None,
                            "datetimeLast": None,
                        }
                    ],
                }
            ]
        }

        async def mock_get(url: str, *args, **kwargs):
            if "locations/10487" in url:
                resp = AsyncMock(spec=httpx.Response)
                resp.is_success = True
                resp.status_code = 200
                resp.json.return_value = station_detail
                return resp
            elif "sensors/34771/hours" in url:
                resp = AsyncMock(spec=httpx.Response)
                resp.is_success = True
                resp.status_code = 200
                resp.json.return_value = {"results": []}
                return resp
            elif "sensors/34771" in url:
                resp = AsyncMock(spec=httpx.Response)
                resp.is_success = True
                resp.status_code = 200
                resp.json.side_effect = ValueError("Invalid JSON document")
                return resp
            resp = AsyncMock(spec=httpx.Response)
            resp.is_success = True
            resp.status_code = 200
            resp.json.return_value = {"results": []}
            return resp

        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            with caplog.at_level(logging.WARNING):
                response = client.get("/api/air-quality/locations/10487/measurements?parameter=pm25")
            assert response.status_code == 200
            data = response.json()
            assert data["total_observations"] == 0
            assert data["sensor_datetime_last_utc"] is None
            assert "Failed to parse JSON response for sensor 34771" in caplog.text
            assert secret_key not in caplog.text


@pytest.mark.anyio
async def test_get_sensor_detail_missing_api_key_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    """Verify that get_sensor_detail directly raises OpenAQMissingKeyError when unconfigured."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "")
    with patch("app.services.openaq.openaq_service.api_key", ""):
        from app.services.openaq import openaq_service, OpenAQMissingKeyError
        with pytest.raises(OpenAQMissingKeyError):
            await openaq_service.get_sensor_detail(34771)


@pytest.mark.anyio
async def test_measurements_excludes_negative_artifacts(monkeypatch: pytest.MonkeyPatch) -> None:
    """
    Verify that negative concentration artifacts (< 0 µg/m³) are filtered out
    from returned measurement points and summary statistics in /measurements,
    with excluded_observations count and data_quality_warnings appropriately reported.
    """
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "test-key-12345")
    with patch("app.services.openaq.openaq_service.api_key", "test-key-12345"):
        mock_raw = {
            "meta": {"name": "openaq-api", "page": 1, "limit": 1000, "found": 3},
            "results": [
                {
                    "value": 45.2,
                    "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                    "period": {
                        "label": "hour",
                        "interval": "01:00:00",
                        "datetimeFrom": {"utc": "2026-10-26T09:00:00Z", "local": "2026-10-26T14:30:00+05:30"},
                        "datetimeTo": {"utc": "2026-10-26T10:00:00Z", "local": "2026-10-26T15:30:00+05:30"},
                    },
                    "coverage": {"percentComplete": 100.0},
                },
                {
                    "value": -999.0,
                    "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                    "period": {
                        "label": "hour",
                        "interval": "01:00:00",
                        "datetimeFrom": {"utc": "2026-10-26T10:00:00Z", "local": "2026-10-26T15:30:00+05:30"},
                        "datetimeTo": {"utc": "2026-10-26T11:00:00Z", "local": "2026-10-26T16:30:00+05:30"},
                    },
                    "coverage": {"percentComplete": 100.0},
                },
                {
                    "value": -5.0,
                    "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                    "period": {
                        "label": "hour",
                        "interval": "01:00:00",
                        "datetimeFrom": {"utc": "2026-10-26T11:00:00Z", "local": "2026-10-26T16:30:00+05:30"},
                        "datetimeTo": {"utc": "2026-10-26T12:00:00Z", "local": "2026-10-26T17:30:00+05:30"},
                    },
                    "coverage": {"percentComplete": 100.0},
                },
            ],
        }

        async def mock_get(url: str, *args, **kwargs):
            if "locations/8118" in url:
                resp = AsyncMock(spec=httpx.Response)
                resp.is_success = True
                resp.status_code = 200
                resp.json.return_value = MOCK_ANAND_VIHAR_DETAIL
                return resp
            elif "sensors/101/hours" in url:
                resp = AsyncMock(spec=httpx.Response)
                resp.is_success = True
                resp.status_code = 200
                resp.json.return_value = mock_raw
                return resp
            resp = AsyncMock(spec=httpx.Response)
            resp.is_success = True
            resp.status_code = 200
            resp.json.return_value = {"results": []}
            return resp

        with patch("httpx.AsyncClient.get", side_effect=mock_get):
            response = client.get("/api/air-quality/locations/8118/measurements?parameter=pm25")
            assert response.status_code == 200
            data = response.json()

            assert data["total_observations"] == 1
            assert data["excluded_observations"] == 2
            assert len(data["measurements"]) == 1
            assert data["measurements"][0]["value"] == 45.2
            assert len(data["data_quality_warnings"]) >= 1
            assert "Excluded 2 invalid negative concentration measurement(s)" in data["data_quality_warnings"][0]
