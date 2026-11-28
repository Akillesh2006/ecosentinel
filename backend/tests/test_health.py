from datetime import datetime
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_check_returns_200_ok() -> None:
    """Verify that the /api/health endpoint returns HTTP 200 and expected payload structure."""
    response = client.get("/api/health")
    assert response.status_code == 200

    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "EcoSentinel"
    assert data["version"] == "0.1.0"
    assert "environment" in data
    assert data["milestone"] == "Milestone 7 - Spatial Analysis & Neighborhood Screening"

    # Verify that timestamp is present and parseable as ISO 8601
    assert "timestamp" in data
    parsed_time = datetime.fromisoformat(data["timestamp"])
    assert parsed_time is not None


def test_root_discovery_endpoint() -> None:
    """Verify that the root endpoint returns discovery links for the API."""
    response = client.get("/")
    assert response.status_code == 200

    data = response.json()
    assert data["app"] == "EcoSentinel"
    assert data["health_check"] == "/api/health"
    assert data["documentation"] == "/api/docs"


def test_not_found_returns_404() -> None:
    """Verify standard 404 behavior for non-existent API routes."""
    response = client.get("/api/nonexistent-route")
    assert response.status_code == 404


def test_cors_headers_allowed_origin() -> None:
    """Verify that CORS headers are returned for allowed development origin."""
    response = client.get(
        "/api/health",
        headers={"Origin": "http://localhost:5173"},
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"


def test_cors_origins_parses_comma_separated_env_string(monkeypatch) -> None:
    """Verify comma-separated CORS_ORIGINS env var (e.g. render.yaml) parses without pydantic SettingsError."""
    from app.core.config import Settings

    monkeypatch.setenv("CORS_ORIGINS", "https://ecosentinel-frontend.onrender.com,http://localhost:5173")
    parsed = Settings()
    assert parsed.CORS_ORIGINS == [
        "https://ecosentinel-frontend.onrender.com",
        "http://localhost:5173",
    ]


def test_invalid_window_returns_400_even_without_api_key() -> None:
    """Input validation must run before API key checks so invalid window returns 400, not 503."""
    response = client.get("/api/air-quality/locations/8118/anomalies?parameter=pm25&window=99d")
    assert response.status_code == 400
    body = response.json()
    assert (body.get("error_code") or body.get("detail", {}).get("error_code")) == "INVALID_WINDOW"


def test_cors_headers_render_origin() -> None:
    """Verify that CORS headers are returned for Render deployment origins."""
    response = client.get(
        "/api/health",
        headers={"Origin": "https://ecosentinel-frontend.onrender.com"},
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "https://ecosentinel-frontend.onrender.com"

