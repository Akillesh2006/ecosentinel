from datetime import datetime
from typing import Any, List, Optional
from fastapi import APIRouter, Query, status
from fastapi.responses import JSONResponse

from app.schemas.air_quality import (
    AirQualityError,
    LocationDetail,
    LocationMeasurementsResponse,
    LocationSummary,
    ProviderStatus,
    RiskAssessmentResponse,
)
from app.services.openaq import OpenAQServiceError, openaq_service

router = APIRouter(prefix="/air-quality", tags=["Air Quality"])


@router.get(
    "/provider-status",
    response_model=ProviderStatus,
    summary="Get Upstream Provider Status",
    description="Check whether the OpenAQ data provider is configured with an API key and reachable.",
)
async def get_provider_status() -> ProviderStatus:
    """Check OpenAQ API configuration and connectivity."""
    return await openaq_service.get_provider_status()


@router.get(
    "/locations",
    response_model=List[LocationSummary],
    responses={
        503: {"model": AirQualityError, "description": "API Key Not Configured"},
        502: {"model": AirQualityError, "description": "Upstream Provider Error"},
        429: {"model": AirQualityError, "description": "Upstream Rate Limit Exceeded"},
    },
    summary="Search Monitoring Locations",
    description="Retrieve air quality monitoring locations, defaulting to India (country=IN), with optional search query.",
)
async def list_locations(
    country: str = Query(default="IN", description="Two-letter ISO 3166-1 country code (default: IN)"),
    search: Optional[str] = Query(default=None, description="Case-insensitive text search for station name or locality"),
    limit: int = Query(default=100, ge=1, le=100, description="Maximum number of stations to return"),
    page: int = Query(default=1, ge=1, description="Results page number"),
) -> Any:
    """Search and filter available monitoring stations."""
    try:
        return await openaq_service.get_locations(
            country=country,
            search=search,
            limit=limit,
            page=page,
        )
    except OpenAQServiceError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": type(exc).__name__,
                "message": exc.message,
                "error_code": exc.error_code,
                "instructions": exc.instructions,
            },
        )


@router.get(
    "/locations/{location_id}",
    response_model=LocationDetail,
    responses={
        404: {"model": AirQualityError, "description": "Station Not Found"},
        503: {"model": AirQualityError, "description": "API Key Not Configured"},
        502: {"model": AirQualityError, "description": "Upstream Provider Error"},
    },
    summary="Get Location Details and Sensors",
    description="Retrieve metadata for a specific station, including coordinates, owner, provider, and available pollutant sensors.",
)
async def get_location(
    location_id: int,
) -> Any:
    """Retrieve station metadata and active sensors."""
    try:
        return await openaq_service.get_location_detail(location_id)
    except OpenAQServiceError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": type(exc).__name__,
                "message": exc.message,
                "error_code": exc.error_code,
                "instructions": exc.instructions,
            },
        )


@router.get(
    "/locations/{location_id}/measurements",
    response_model=LocationMeasurementsResponse,
    responses={
        400: {"model": AirQualityError, "description": "Invalid parameter or time range"},
        404: {"model": AirQualityError, "description": "Station or sensor not found"},
        503: {"model": AirQualityError, "description": "API Key Not Configured"},
        502: {"model": AirQualityError, "description": "Upstream Provider Error"},
    },
    summary="Get Historical Measurements for a Station",
    description="Retrieve bounded time-series observations for a given station and pollutant parameter (e.g. pm25, pm10, no2).",
)
async def get_measurements(
    location_id: int,
    parameter: Optional[str] = Query(default=None, description="Pollutant parameter code (e.g. pm25, pm10, no2, o3, co, so2)"),
    sensor_id: Optional[int] = Query(default=None, description="Specific OpenAQ sensor ID (optional if parameter is provided)"),
    date_from: Optional[datetime] = Query(default=None, description="Start date/time in ISO 8601 (defaults to 24h prior to date_to)"),
    date_to: Optional[datetime] = Query(default=None, description="End date/time in ISO 8601 (defaults to now)"),
    limit: int = Query(default=1000, ge=1, le=1000, description="Maximum observations to return"),
) -> Any:
    """Retrieve normalized time-series measurements with coverage calculation."""
    try:
        return await openaq_service.get_measurements(
            location_id=location_id,
            parameter=parameter,
            sensor_id=sensor_id,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
        )
    except OpenAQServiceError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": type(exc).__name__,
                "message": exc.message,
                "error_code": exc.error_code,
                "instructions": exc.instructions,
            },
        )


@router.get(
    "/locations/{location_id}/assessment",
    response_model=RiskAssessmentResponse,
    responses={
        400: {"model": AirQualityError, "description": "Invalid parameter"},
        404: {"model": AirQualityError, "description": "Station or sensor not found"},
        503: {"model": AirQualityError, "description": "API Key Not Configured"},
        502: {"model": AirQualityError, "description": "Upstream Provider Error"},
    },
    summary="Get Operational Risk Assessment and Mitigation Advisory",
    description="Calculate evidence-backed risk assessment against statutory CPCB NAAQS (2009) and WHO (2021) guidelines for a station and parameter.",
)
async def get_risk_assessment(
    location_id: int,
    parameter: Optional[str] = Query(default="pm25", description="Pollutant parameter code (e.g. pm25, pm10, no2, o3, co, so2)"),
    sensor_id: Optional[int] = Query(default=None, description="Specific OpenAQ sensor ID (optional if parameter is provided)"),
    reference_time: Optional[datetime] = Query(default=None, description="Injectable reference datetime in ISO 8601 for deterministic testing or historical assessment"),
) -> Any:
    """Evaluate 24h/8h rolling observations against CPCB NAAQS and generate practical mitigation advisories."""
    try:
        return await openaq_service.calculate_risk_assessment(
            location_id=location_id,
            parameter=parameter,
            sensor_id=sensor_id,
            reference_time=reference_time,
        )
    except OpenAQServiceError as exc:
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": type(exc).__name__,
                "message": exc.message,
                "error_code": exc.error_code,
                "instructions": exc.instructions,
            },
        )
