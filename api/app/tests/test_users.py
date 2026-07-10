from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from tests.conftest import add_member, auth_as, make_user, make_workspace


def test_get_user_no_shared_workspace_hides_email(
    client: TestClient, db: Session
) -> None:
    """Core regression test for issue #25: a user with no shared workspace
    must not be able to retrieve another user's email via this endpoint."""
    requester = make_user(db)
    target = make_user(db)
    auth_as(client, requester)

    response = client.get(f"/api/users/{target.id}")

    assert response.status_code == 200
    body = response.json()
    assert set(body.keys()) == {"id", "username", "display_name", "avatar_url"}
    assert "email" not in body
    assert "email_verified" not in body
    assert "first_name" not in body
    assert "last_name" not in body


def test_get_user_self_lookup_returns_full_profile(
    client: TestClient, db: Session
) -> None:
    user = make_user(db)
    auth_as(client, user)

    response = client.get(f"/api/users/{user.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == user.email
    assert body["email_verified"] == user.email_verified


def test_get_user_shared_workspace_returns_full_profile(
    client: TestClient, db: Session
) -> None:
    owner = make_user(db)
    member = make_user(db)
    workspace = make_workspace(db, owner=owner)
    add_member(db, workspace=workspace, user=member)
    auth_as(client, owner)

    response = client.get(f"/api/users/{member.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["email"] == member.email
    assert body["email_verified"] == member.email_verified


def test_get_user_display_name_never_leaks_email_local_part(
    client: TestClient, db: Session
) -> None:
    """Regression test for the coderabbitai finding: when a user has no
    first_name/last_name set, the public response's display_name must fall
    back to username, never to the email local part."""
    requester = make_user(db)
    target = make_user(
        db,
        email="secretlocalpart@test.com",
        first_name=None,
        last_name=None,
    )
    auth_as(client, requester)

    response = client.get(f"/api/users/{target.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["display_name"] == target.username
    assert "secretlocalpart" not in body["display_name"]


def test_get_user_not_found_returns_404(client: TestClient, db: Session) -> None:
    import uuid

    requester = make_user(db)
    auth_as(client, requester)

    response = client.get(f"/api/users/{uuid.uuid4()}")

    assert response.status_code == 404