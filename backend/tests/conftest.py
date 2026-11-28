import pytest
from app.core.config import settings
from app.services.openaq import openaq_service


@pytest.fixture(autouse=True)
def reset_openaq_cache():
    """Clears all in-memory caches and inflight tracking in openaq_service before and after each test."""
    caches = (
        openaq_service._locations_cache,
        openaq_service._location_detail_cache,
        openaq_service._sensor_detail_cache,
        openaq_service._measurements_cache,
    )
    for cache in caches:
        cache._cache.clear()
        cache._inflight.clear()
    yield
    for cache in caches:
        cache._cache.clear()
        cache._inflight.clear()


@pytest.fixture(autouse=True)
def isolate_openaq_api_key(monkeypatch):
    """Isolates tests from local .env OPENAQ_API_KEY so suite passes identically without a key."""
    monkeypatch.setattr(settings, "OPENAQ_API_KEY", None)
    monkeypatch.setattr(openaq_service, "api_key", None)
