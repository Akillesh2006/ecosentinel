from datetime import datetime
from typing import Any, List, Optional
from fastapi import APIRouter, Query, status
from fastapi.responses import JSONResponse

from app.schemas.air_quality import (
    AirQualityAnomalyResponse,
    AirQualityError,
    LocationDetail,
    LocationMeasurementsResponse,
    LocationSummary,
    ProviderStatus,
    RiskAssessmentResponse,
    IdlingAbatementResponse,
)
from app.schemas.spatial import (
    SpatialComparisonRequest,
    SpatialComparisonResponse,
    SpatialNeighborsResponse,
)
from app.core.standards import calculate_idling_abatement
from app.services.openaq import OpenAQServiceError, openaq_service
from app.services.spatial import spatial_service

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

@router.get(
    "/locations/{location_id}/anomalies",
    response_model=AirQualityAnomalyResponse,
    responses={
        400: {"model": AirQualityError, "description": "Invalid parameter or window"},
        404: {"model": AirQualityError, "description": "Station or sensor not found"},
        503: {"model": AirQualityError, "description": "API Key Not Configured"},
        502: {"model": AirQualityError, "description": "Upstream Provider Error"},
    },
    summary="Detect Air Quality Statistical Anomalies and Baseline Deviations",
    description=(
        "Evaluate air quality observations for statistical anomalies using Jackknife Leave-One-Out MAD across the "
        "chosen evaluation window ('24h' for the 24-hour window, or '7d' for the complete 168-hour evaluation interval). "
        "Each observation is evaluated against a baseline of the remaining valid observations in that interval, "
        "preventing each point from contaminating its own baseline."
    ),
)
async def get_air_quality_anomalies(
    location_id: int,
    parameter: Optional[str] = Query(default="pm25", description="Pollutant parameter code (e.g. pm25, pm10, no2, o3, co, so2)"),
    window: Optional[str] = Query(default="24h", description="Evaluation window preset: '24h' for 24-hour evaluation or '7d' for the complete 168-hour evaluation interval"),
    sensor_id: Optional[int] = Query(default=None, description="Specific OpenAQ sensor ID (optional)"),
    reference_time: Optional[datetime] = Query(default=None, description="Injectable reference datetime in ISO 8601 for deterministic testing or historical analysis"),
    sensor_precision: Optional[float] = Query(default=None, description="Optional caller-supplied precision threshold for diagnostic invariance screening (labeled as caller-supplied; not verified metadata)"),
) -> Any:
    """Detect statistical anomalies using non-parametric robust leave-one-out baselines."""
    try:
        return await openaq_service.detect_anomalies(
            location_id=location_id,
            parameter=parameter,
            window=window,
            reference_time=reference_time,
            sensor_id=sensor_id,
            sensor_precision=sensor_precision,
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
    "/abatement/estimate",
    response_model=IdlingAbatementResponse,
    responses={
        422: {"model": AirQualityError, "description": "Validation Error"},
    },
    summary="Estimate Potential Emissions Abatement from Anti-Idling",
    description="Calculate evidence-backed engineering estimates of potential emissions avoided from heavy vehicle anti-idling curtailment.",
)
async def get_abatement_estimate(
    vehicles: Optional[int] = Query(default=10, description="Number of eligible heavy commercial vehicles (1 to 200)"),
    hours: Optional[float] = Query(default=2.0, description="Curtailed idling duration per vehicle in hours (0.5 to 12.0)"),
) -> Any:
    """Calculate potential fuel and emissions abatement from heavy diesel vehicle anti-idling."""
    if vehicles is None or vehicles < 1 or vehicles > 200:
        return JSONResponse(
            status_code=422,
            content={
                "error": "ValidationError",
                "message": "Vehicle count must be an integer between 1 and 200.",
                "error_code": "INVALID_VEHICLE_COUNT",
                "instructions": "Enter an integer vehicle count between 1 and 200.",
            },
        )
    if hours is None or hours < 0.5 or hours > 12.0:
        return JSONResponse(
            status_code=422,
            content={
                "error": "ValidationError",
                "message": "Curtailed idling duration must be between 0.5 and 12.0 hours.",
                "error_code": "INVALID_IDLE_HOURS",
                "instructions": "Enter an idle duration between 0.5 and 12.0 hours.",
            },
        )

    try:
        return calculate_idling_abatement(vehicles=vehicles, hours=hours)
    except ValueError as exc:
        return JSONResponse(
            status_code=422,
            content={
                "error": "ValidationError",
                "message": str(exc),
                "error_code": "INVALID_ABATEMENT_INPUT",
                "instructions": "Enter valid numeric parameters within the stated bounds.",
            },
        )


@router.get(
    "/spatial/neighbors",
    response_model=SpatialNeighborsResponse,
    responses={
        400: {"model": AirQualityError, "description": "Invalid radius or unsupported pollutant"},
        404: {"model": AirQualityError, "description": "Reference station not found"},
        422: {"model": AirQualityError, "description": "Reference station missing coordinates"},
        503: {"model": AirQualityError, "description": "API Key Not Configured"},
        502: {"model": AirQualityError, "description": "Upstream Provider Error"},
    },
    summary="Discover Nearby Monitoring Stations",
    description="Discover eligible monitoring stations within a geographic radius (km) that monitor the requested pollutant.",
)
async def get_spatial_neighbors(
    reference_location_id: int = Query(..., description="ID of the reference monitoring station"),
    parameter: str = Query(..., description="Target pollutant code (e.g. pm25, pm10, no2, o3)"),
    radius_km: float = Query(default=25.0, ge=1.0, le=100.0, description="Spatial search radius in kilometers (1.0 to 100.0 km)"),
    limit: int = Query(default=20, ge=1, le=50, description="Maximum number of eligible neighbor stations to return"),
) -> Any:
    """Discover pollutant-compatible monitoring stations within a geographic radius."""
    try:
        return await spatial_service.discover_neighbors(
            reference_location_id=reference_location_id,
            parameter=parameter,
            radius_km=radius_km,
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

@router.post(
    "/spatial/compare",
    response_model=SpatialComparisonResponse,
    responses={
        400: {"model": AirQualityError, "description": "Validation or station incompatibility error"},
        404: {"model": AirQualityError, "description": "Station not found"},
        422: {"model": AirQualityError, "description": "Request validation error"},
        503: {"model": AirQualityError, "description": "API Key Not Configured"},
        502: {"model": AirQualityError, "description": "Upstream Provider Error"},
    },
    summary="Compare Multi-Station Time-Series Synchronously",
    description="Synchronize and compare hourly observations across 2 to 5 stations (1 reference and up to 4 neighbors).",
)
async def compare_spatial_stations(
    request: SpatialComparisonRequest,
) -> Any:
    """Synchronize time series across 2 to 5 monitoring stations, computing coverage and spatial metrics."""
    try:
        return await spatial_service.compare_stations(request)
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
