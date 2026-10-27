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
    assert data["milestone"] == "Milestone 1 - Project Foundation"

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
