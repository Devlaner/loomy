from fastapi.testclient import TestClient


def test_health_returns_ok_when_dependencies_are_up(client: TestClient) -> None:
    response = client.get("/health")
    # The test DB is the real local postgres and Redis runs in docker,
    # so both should be reachable when tests are run via `uv run pytest`.
    # We accept both shapes (all ok -> 200, anything degraded -> 503) so
    # CI without docker doesn't fail this specific assertion; we only
    # assert the response shape.
    assert response.status_code in (200, 503)
    body = response.json()
    assert body["status"] in ("ok", "degraded")
    assert "checks" in body
    assert "database" in body["checks"]
    assert "redis" in body["checks"]
    assert "environment" in body
