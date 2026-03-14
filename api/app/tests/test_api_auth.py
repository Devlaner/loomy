from fastapi.testclient import TestClient


def test_boards_list_requires_auth(client: TestClient) -> None:
    response = client.get("/api/boards?workspace_id=00000000-0000-0000-0000-000000000000")
    assert response.status_code == 401


def test_login_rejects_invalid_json(client: TestClient) -> None:
    response = client.post(
        "/api/auth/login",
        content="not json",
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422
