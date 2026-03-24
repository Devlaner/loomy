from typing import Tuple
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.users.model import User
from app.modules.workspaces.model import Workspace, WorkspaceInvitation
from app.modules.workspaces.repository import (
    create_invitation,
    create as create_workspace,
    delete as delete_workspace,
    add_member,
    get_invitation_by_token,
    list_workspace_invitations,
    get_by_id,
    get_user_workspaces,
    is_member,
    mark_invitation_accepted,
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


def create_workspace_invitation_for_user(
    db: Session,
    workspace_id: UUID,
    user: User,
    *,
    email: str,
    role: str = "member",
) -> WorkspaceInvitation | None:
    workspace = get_workspace(db, workspace_id, user)
    if not workspace or workspace.owner_id != user.id:
        return None
    return create_invitation(
        db,
        workspace_id=workspace_id,
        email=email,
        role=role,
        invited_by=user.id,
    )


def get_workspace_invitation_by_token(
    db: Session, token: str
) -> WorkspaceInvitation | None:
    return get_invitation_by_token(db, token)


def list_workspace_invitations_for_user(
    db: Session,
    workspace_id: UUID,
    user: User,
) -> list[WorkspaceInvitation] | None:
    workspace = get_workspace(db, workspace_id, user)
    if workspace is None:
        return None
    if workspace.owner_id != user.id:
        return None
    return list_workspace_invitations(db, workspace_id=workspace_id, pending_only=True)


def accept_workspace_invitation_for_user(
    db: Session, token: str, user: User
) -> WorkspaceInvitation | None:
    invitation = get_invitation_by_token(db, token)
    if not invitation:
        return None
    if invitation.accepted_at is not None:
        return None
    if invitation.expires_at is not None and invitation.expires_at <= datetime.now(timezone.utc):
        return None
    if invitation.email.strip().lower() != user.email.strip().lower():
        return None

    if not is_member(db, invitation.workspace_id, user.id):
        add_member(db, invitation.workspace_id, user.id, role=invitation.role)
    return mark_invitation_accepted(db, invitation)
