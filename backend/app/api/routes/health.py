from datetime import datetime, timezone
from fastapi import APIRouter, status
from pydantic import BaseModel, Field

from app.core.config import settings

router = APIRouter(tags=["Health"])


class HealthResponse(BaseModel):
    """Schema for the health check response."""

    status: str = Field(
        default="ok",
        description="Operational status of the backend service",
        examples=["ok"],
    )
    app: str = Field(
        description="Application name",
        examples=["EcoSentinel"],
    )
    version: str = Field(
        description="Application release version",
        examples=["0.1.0"],
    )
    timestamp: datetime = Field(
        description="Current server timestamp in ISO 8601 UTC",
    )
    environment: str = Field(
        description="Current execution environment",
        examples=["development"],
    )
    milestone: str = Field(
        default="Milestone 1 - Project Foundation",
        description="Current project development milestone",
        examples=["Milestone 1 - Project Foundation"],
    )


@router.get(
    "/health",
    response_model=HealthResponse,
    status_code=status.HTTP_200_OK,
    summary="Service Health Check",
    description="Check the operational health status of the EcoSentinel backend. Operates without requiring a database connection.",
)
async def get_health() -> HealthResponse:
    """Return operational health status for the EcoSentinel backend service."""
    return HealthResponse(
        status="ok",
        app=settings.PROJECT_NAME,
        version=settings.VERSION,
        timestamp=datetime.now(timezone.utc),
        environment=settings.ENVIRONMENT,
        milestone="Milestone 1 - Project Foundation",
    )
