import asyncio
import time
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from app.core.config import settings
from app.schemas.air_quality import Coordinates, LocationDetail, LocationMeasurementsResponse, MeasurementPoint, SensorSummary
from app.services.openaq import OpenAQClient, OpenAQServiceError, TTLCache, openaq_service
from app.services.spatial import SpatialService


@pytest.mark.anyio
async def test_ttl_cache_basic_get_set_and_expiration():
    """Verify TTLCache stores, retrieves, and expires entries correctly."""
    cache = TTLCache[str](maxsize=10)

    # Initial get returns None
    assert await cache.get("key1") is None

    # Set with 0.1s TTL
    await cache.set("key1", "value1", ttl_seconds=0.1)
    assert await cache.get("key1") == "value1"

    # Wait for expiration
    await asyncio.sleep(0.15)
    assert await cache.get("key1") is None


@pytest.mark.anyio
async def test_ttl_cache_lru_bounded_eviction():
    """Verify TTLCache bounded capacity and LRU eviction."""
    cache = TTLCache[int](maxsize=3)

    await cache.set("a", 1, ttl_seconds=60.0)
    await cache.set("b", 2, ttl_seconds=60.0)
    await cache.set("c", 3, ttl_seconds=60.0)

    # Access "a" so it is recently used: order becomes b, c, a
    assert await cache.get("a") == 1

    # Adding "d" should evict "b" (least recently used)
    await cache.set("d", 4, ttl_seconds=60.0)

    assert await cache.get("b") is None
    assert await cache.get("a") == 1
    assert await cache.get("c") == 3
    assert await cache.get("d") == 4


@pytest.mark.anyio
async def test_ttl_cache_stampede_coalescing():
    """Verify concurrent requests for the same uncached key coalesce into a single fetch execution."""
    cache = TTLCache[str](maxsize=10)
    fetch_count = 0

    async def mock_slow_fetcher():
        nonlocal fetch_count
        fetch_count += 1
        await asyncio.sleep(0.05)
        return f"result-{fetch_count}"

    # Fire 5 concurrent requests for key "test"
    results = await asyncio.gather(
        cache.get_or_compute("test", ttl_seconds=60.0, fetcher=mock_slow_fetcher),
        cache.get_or_compute("test", ttl_seconds=60.0, fetcher=mock_slow_fetcher),
        cache.get_or_compute("test", ttl_seconds=60.0, fetcher=mock_slow_fetcher),
        cache.get_or_compute("test", ttl_seconds=60.0, fetcher=mock_slow_fetcher),
        cache.get_or_compute("test", ttl_seconds=60.0, fetcher=mock_slow_fetcher),
    )

    # All 5 callers get the exact same result, and fetcher was executed exactly once
    assert len(results) == 5
    assert all(r == "result-1" for r in results)
    assert fetch_count == 1


@pytest.mark.anyio
async def test_ttl_cache_does_not_cache_exceptions():
    """Verify failed computations raise and are never cached."""
    cache = TTLCache[str](maxsize=10)
    attempt = 0

    async def failing_fetcher():
        nonlocal attempt
        attempt += 1
        if attempt == 1:
            raise OpenAQServiceError(message="Upstream 502 error", status_code=502)
        return "success"

    # First attempt fails
    with pytest.raises(OpenAQServiceError) as exc_info:
        await cache.get_or_compute("fail_key", ttl_seconds=60.0, fetcher=failing_fetcher)
    assert exc_info.value.status_code == 502

    # Cache should be empty for fail_key
    assert await cache.get("fail_key") is None

    # Second attempt succeeds and populates cache
    res = await cache.get_or_compute("fail_key", ttl_seconds=60.0, fetcher=failing_fetcher)
    assert res == "success"
    assert await cache.get("fail_key") == "success"


@pytest.mark.anyio
async def test_auth_fingerprint_cache_separation(monkeypatch):
    """Verify different API keys produce different auth fingerprints to avoid cross-tenant cache contamination."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "")
    client1 = OpenAQClient(api_key="key-tenant-alpha")
    client2 = OpenAQClient(api_key="key-tenant-beta")
    anon_client = OpenAQClient(api_key="")

    fp1 = client1._get_auth_fingerprint()
    fp2 = client2._get_auth_fingerprint()
    fp_anon = anon_client._get_auth_fingerprint()

    assert fp1 != fp2
    assert fp1 != fp_anon
    assert fp_anon == "anon"
    # Never leak the actual key
    assert "key-tenant" not in fp1
    assert "key-tenant" not in fp2


@pytest.mark.anyio
async def test_http_client_connection_pooling_and_lifecycle():
    """Verify OpenAQClient reuses its httpx.AsyncClient and closes cleanly on close()."""
    client = OpenAQClient(api_key="mock_key")

    http_client1 = await client.get_http_client()
    assert isinstance(http_client1, httpx.AsyncClient)
    assert not http_client1.is_closed

    # Second retrieval reuses the identical client instance
    http_client2 = await client.get_http_client()
    assert http_client1 is http_client2

    # Clean lifecycle shutdown
    await client.close()
    assert http_client1.is_closed
    assert client._client is None

    # Subsequent call creates a new client
    http_client3 = await client.get_http_client()
    assert not http_client3.is_closed
    assert http_client3 is not http_client1
    await client.close()


@pytest.mark.anyio
async def test_locations_cache_hit_and_dynamic_staleness(monkeypatch):
    """Verify locations caching hits cache on second call and dynamically evaluates staleness."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", "test_key_caching")
    client = OpenAQClient(api_key="test_key_caching")

    mock_response_payload = {
        "meta": {"name": "openaq-api", "page": 1, "limit": 10, "found": 1},
        "results": [
            {
                "id": 9999,
                "name": "Cache Test Station",
                "locality": "Delhi",
                "timezone": "Asia/Kolkata",
                "coordinates": {"latitude": 28.6, "longitude": 77.2},
                "sensors": [
                    {
                        "id": 1,
                        "name": "pm25",
                        "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                        "datetimeLast": {"utc": "2026-11-13T10:00:00Z", "local": "2026-11-13T15:30:00+05:30"},
                    }
                ],
                "datetimeLast": {"utc": "2026-11-13T10:00:00Z", "local": "2026-11-13T15:30:00+05:30"},
            }
        ],
    }

    call_count = 0

    async def mock_get(url, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        resp = AsyncMock(spec=httpx.Response)
        resp.is_success = True
        resp.status_code = 200
        resp.json = lambda: mock_response_payload
        return resp

    with patch("httpx.AsyncClient.get", side_effect=mock_get):
        # Call 1: Fetches from upstream
        res1 = await client.get_locations(search="Delhi", limit=10)
        assert len(res1) == 1
        assert res1[0].id == 9999
        assert call_count == 1

        # Call 2: Returns from cache without calling upstream
        res2 = await client.get_locations(search="Delhi", limit=10)
        assert len(res2) == 1
        assert res2[0].id == 9999
        assert call_count == 1  # call count did not increase!

        # Call with different parameter: Calls upstream
        res3 = await client.get_locations(search="Chennai", limit=10)
        assert call_count == 2

    await client.close()


@pytest.mark.anyio
async def test_location_detail_cache_hit_and_staleness(monkeypatch):
    """Verify location detail caching hits cache on second call."""
    client = OpenAQClient(api_key="test_key_caching_detail")

    station_payload = {
        "results": [
            {
                "id": 1234,
                "name": "Detail Station",
                "locality": "Delhi",
                "timezone": "Asia/Kolkata",
                "coordinates": {"latitude": 28.6, "longitude": 77.2},
                "sensors": [
                    {
                        "id": 101,
                        "name": "pm25",
                        "parameter": {"id": 2, "name": "pm25", "units": "µg/m³", "displayName": "PM2.5"},
                        "datetimeLast": {"utc": "2026-11-14T00:00:00Z"},
                    }
                ],
            }
        ]
    }

    call_count = 0

    async def mock_get(url, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        resp = AsyncMock(spec=httpx.Response)
        resp.is_success = True
        resp.status_code = 200
        resp.json = lambda: station_payload
        return resp

    with patch("httpx.AsyncClient.get", side_effect=mock_get):
        loc1 = await client.get_location_detail(1234)
        assert loc1.id == 1234
        assert call_count == 1

        loc2 = await client.get_location_detail(1234)
        assert loc2.id == 1234
        assert call_count == 1

    await client.close()


@pytest.mark.anyio
async def test_measurements_cache_hit_and_dynamic_completeness(monkeypatch):
    """Verify measurements caching hits cache on second call and re-evaluates completeness."""
    client = OpenAQClient(api_key="test_key_meas_caching")

    # Mock get_location_detail
    now_utc = datetime.now(timezone.utc)
    mock_loc = LocationDetail(
        id=777,
        name="Measurements Test Station",
        locality="Delhi",
        provider_name="DPCC",
        sensors=[
            SensorSummary(
                id=888,
                name="pm25",
                parameter_id=2,
                parameter_name="pm25",
                parameter_display_name="PM2.5",
                units="µg/m³",
                datetime_last_utc=now_utc - timedelta(hours=2),
                datetime_last_local="2026-11-14T10:00:00+05:30",
            )
        ],
    )

    client.get_location_detail = AsyncMock(return_value=mock_loc)

    meas_payload = {
        "results": [
            {
                "value": 55.5,
                "period": {
                    "label": "hour",
                    "interval": "01:00:00",
                    "datetimeFrom": {"utc": (now_utc - timedelta(hours=2)).strftime("%Y-%m-%dT%H:%M:%SZ")},
                    "datetimeTo": {"utc": (now_utc - timedelta(hours=1)).strftime("%Y-%m-%dT%H:%M:%SZ")},
                },
            }
        ]
    }

    call_count = 0

    async def mock_get(url, *args, **kwargs):
        nonlocal call_count
        call_count += 1
        resp = AsyncMock(spec=httpx.Response)
        resp.is_success = True
        resp.status_code = 200
        resp.json = lambda: meas_payload
        return resp

    with patch("httpx.AsyncClient.get", side_effect=mock_get):
        res1 = await client.get_measurements(
            location_id=777,
            parameter="pm25",
            date_from=now_utc - timedelta(hours=24),
            date_to=now_utc,
        )
        assert len(res1.measurements) == 1
        assert call_count == 1

        # Second call with identical window hits cache
        res2 = await client.get_measurements(
            location_id=777,
            parameter="pm25",
            date_from=now_utc - timedelta(hours=24),
            date_to=now_utc,
        )
        assert len(res2.measurements) == 1
        assert call_count == 1  # No upstream fetch!
        assert res2.is_stale is False

    await client.close()


@pytest.mark.anyio
async def test_spatial_service_error_sanitization():
    """Verify that compare_stations sanitizes raw upstream exception details."""
    spatial = SpatialService()

    # If get_location_detail fails with a non-OpenAQ exception, it shouldn't leak raw internal string
    with patch.object(spatial.openaq, "api_key", "test-key"), patch.object(
        spatial.openaq,
        "get_location_detail",
        side_effect=RuntimeError("internal_db_failure_at_socket_345"),
    ):
        from app.schemas.spatial import SpatialComparisonRequest

        req = SpatialComparisonRequest(
            reference_location_id=1,
            neighbor_location_ids=[2],
            parameter="pm25",
        )
        with pytest.raises(OpenAQServiceError) as exc_info:
            await spatial.compare_stations(req)

        # Message is sanitized and does not leak internal error string
        assert "internal_db_failure" not in exc_info.value.message
        assert "could not be retrieved" in exc_info.value.message
