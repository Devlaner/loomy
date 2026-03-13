from typing import Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.users.model import User
from app.modules.workspaces.model import Workspace
from app.modules.workspaces.repository import (
    create as create_workspace,
    delete as delete_workspace,
    get_by_id,
    get_user_workspaces,
    is_member,
    make_unique_slug,
    update as update_workspace,
)
from app.modules.workspaces.schemas import WorkspaceCreate, WorkspaceUpdate


def get_workspace(db: Session, workspace_id: UUID, user: User) -> Workspace | None:
    workspace = get_by_id(db, workspace_id)
    if not workspace:
        return None
    if not is_member(db, workspace_id, user.id):
        return None
    return workspace


def list_workspaces(
    db: Session, user: User, page: int = 1, limit: int = 20
) -> Tuple[list[Workspace], int]:
    return get_user_workspaces(db, user.id, page, limit)


def create_workspace_for_user(db: Session, user: User, data: WorkspaceCreate) -> Workspace:
    slug = make_unique_slug(db, data.name)
    return create_workspace(db, name=data.name, slug=slug, owner_id=user.id)


def create_default_workspace_for_user(
    db: Session, user: User, first_name: str, last_name: str
) -> Workspace:
    """Create a default workspace from user's first and last name."""
    name = f"{first_name} {last_name}".strip() or user.username
    base_slug = f"{first_name}-{last_name}".strip().lower() or user.username
    slug = make_unique_slug(db, base_slug)
    return create_workspace(db, name=name, slug=slug, owner_id=user.id)


def update_workspace_for_user(
    db: Session, workspace_id: UUID, user: User, data: WorkspaceUpdate
) -> Workspace | None:
    workspace = get_workspace(db, workspace_id, user)
    if not workspace:
        return None
    if workspace.owner_id != user.id:
        return None  # Only owner can update
    return update_workspace(db, workspace, name=data.name)


def delete_workspace_for_user(db: Session, workspace_id: UUID, user: User) -> bool:
    workspace = get_workspace(db, workspace_id, user)
    if not workspace:
        return False
    if workspace.owner_id != user.id:
        return False
    delete_workspace(db, workspace)
    return True
