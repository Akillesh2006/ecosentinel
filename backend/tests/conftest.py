import pytest
from app.services.openaq import openaq_service


@pytest.fixture(autouse=True)
def reset_openaq_cache():
    """Clears all in-memory caches and inflight tracking in openaq_service before and after each test for test isolation."""
    openaq_service._locations_cache._cache.clear()
    openaq_service._locations_cache._inflight.clear()
    openaq_service._location_detail_cache._cache.clear()
    openaq_service._location_detail_cache._inflight.clear()
    openaq_service._sensor_detail_cache._cache.clear()
    openaq_service._sensor_detail_cache._inflight.clear()
    openaq_service._measurements_cache._cache.clear()
    openaq_service._measurements_cache._inflight.clear()    yield
    openaq_service._locations_cache._cache.clear()
    openaq_service._locations_cache._inflight.clear()
    openaq_service._location_detail_cache._cache.clear()
    openaq_service._location_detail_cache._inflight.clear()
    openaq_service._sensor_detail_cache._cache.clear()
    openaq_service._sensor_detail_cache._inflight.clear()
    openaq_service._measurements_cache._cache.clear()
    openaq_service._measurements_cache._inflight.clear()
