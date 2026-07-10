import uuid
import os
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.api.deps import get_current_user
from app.db.session import get_db
from app.main import app
from app.modules.users.model import User
from app.modules.workspaces.model import Workspace, WorkspaceMember

TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql://postgres:postgres@localhost:15432/loomy_test",
)

engine = create_engine(TEST_DATABASE_URL)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture
def db() -> Generator[Session, None, None]:
    """Each test runs inside a transaction that is rolled back afterward,
    so tests never leave residue in loomy_test and can run in any order."""
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture
def client(db: Session) -> Generator[TestClient, None, None]:
    def _get_db_override() -> Generator[Session, None, None]:
        yield db

    app.dependency_overrides[get_db] = _get_db_override
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def make_user(
    db: Session,
    *,
    email: str | None = None,
    username: str | None = None,
    first_name: str | None = "Test",
    last_name: str | None = "User",
) -> User:
    """Create and persist a real User row for use in tests."""
    unique = uuid.uuid4().hex[:8]
    user = User(
        email=email or f"user-{unique}@test.com",
        username=username or f"user{unique}",
        # Password hash is irrelevant here since tests authenticate via
        # the get_current_user override, not a real login flow.
        hashed_password="not-a-real-hash",
        first_name=first_name,
        last_name=last_name,
        email_verified=False,
    )
    db.add(user)
    db.flush()
    db.refresh(user)
    return user


def make_workspace(db: Session, *, owner: User, name: str = "Test Workspace") -> Workspace:
    """Create a workspace owned by `owner`, and add the owner as a member
    (mirrors workspaces/repository.py's create())."""
    unique = uuid.uuid4().hex[:8]
    workspace = Workspace(name=name, slug=f"test-workspace-{unique}", owner_id=owner.id)
    db.add(workspace)
    db.flush()
    db.refresh(workspace)
    member = WorkspaceMember(workspace_id=workspace.id, user_id=owner.id, role="owner")
    db.add(member)
    db.flush()
    return workspace


def add_member(db: Session, *, workspace: Workspace, user: User, role: str = "member") -> None:
    member = WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role=role)
    db.add(member)
    db.flush()


def auth_as(client: TestClient, user: User) -> None:
    """Override get_current_user so requests through `client` are
    authenticated as `user`, without going through a real JWT login."""
    app.dependency_overrides[get_current_user] = lambda: user