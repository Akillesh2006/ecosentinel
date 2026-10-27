from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes.air_quality import router as air_quality_router
from app.api.routes.health import router as health_router
from app.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "EcoSentinel is a software-only environmental intelligence platform "
        "designed for detecting unusual air-quality patterns using time-aware "
        "comparisons and explainable statistical analysis."
    ),
    openapi_url=f"{settings.API_PREFIX}/openapi.json",
    docs_url=f"{settings.API_PREFIX}/docs",
    redoc_url=f"{settings.API_PREFIX}/redoc",
)

# Configure Cross-Origin Resource Sharing (CORS) restricted to authorized origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Register API routers under configured prefix (e.g. /api)
app.include_router(health_router, prefix=settings.API_PREFIX)
app.include_router(air_quality_router, prefix=settings.API_PREFIX)


@app.get("/", include_in_schema=False)
async def root() -> JSONResponse:
    """Root entry point providing discovery links for documentation and health status."""
    return JSONResponse(
        content={
            "app": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "description": "Evidence-based environmental intelligence platform",
            "health_check": f"{settings.API_PREFIX}/health",
            "documentation": f"{settings.API_PREFIX}/docs",
        }
    )
