import re
import secrets
from datetime import datetime, timedelta, timezone
from typing import Tuple, List
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.modules.workspaces.model import Workspace, WorkspaceInvitation, WorkspaceMember


def _slugify(text: str) -> str:
    s = (text or "").lower().strip()
    s = re.sub(r"[^\w\s-]", "", s)
    s = re.sub(r"[-\s]+", "-", s).strip("-")
    return s[:100] or "workspace"


def get_by_slug(db: Session, slug: str) -> Workspace | None:
    return db.query(Workspace).filter(Workspace.slug == slug).first()


def make_unique_slug(db: Session, base_slug: str) -> str:
    """Return a unique slug, appending random digits if base_slug exists."""
    slug = _slugify(base_slug) or "workspace"
    while get_by_slug(db, slug):
        slug = f"{slug}-{secrets.randbelow(10000):04d}"
    return slug


def get_by_id(db: Session, workspace_id: UUID) -> Workspace | None:
    return (
        db.query(Workspace)
        .options(joinedload(Workspace.owner))
        .filter(Workspace.id == workspace_id)
        .first()
    )


def get_by_owner(
    db: Session, owner_id: UUID, page: int = 1, limit: int = 20
) -> Tuple[List[Workspace], int]:
    offset = (page - 1) * limit
    query = db.query(Workspace).filter(Workspace.owner_id == owner_id)
    total = db.query(func.count(Workspace.id)).filter(Workspace.owner_id == owner_id).scalar() or 0
    items = query.order_by(Workspace.created_at.desc()).offset(offset).limit(limit).all()
    return items, total


def get_user_workspaces(
    db: Session, user_id: UUID, page: int = 1, limit: int = 20
) -> Tuple[List[Workspace], int]:
    offset = (page - 1) * limit
    member_workspace_ids = [
        r[0]
        for r in db.query(WorkspaceMember.workspace_id)
        .filter(WorkspaceMember.user_id == user_id)
        .all()
    ]
    if member_workspace_ids:
        query = (
            db.query(Workspace)
            .options(joinedload(Workspace.owner))
            .filter((Workspace.owner_id == user_id) | (Workspace.id.in_(member_workspace_ids)))
        )
    else:
        query = (
            db.query(Workspace)
            .options(joinedload(Workspace.owner))
            .filter(Workspace.owner_id == user_id)
        )
    total = query.count()
    items = query.order_by(Workspace.created_at.desc()).offset(offset).limit(limit).all()
    return items, total


def create(db: Session, *, name: str, slug: str, owner_id: UUID) -> Workspace:
    workspace = Workspace(name=name, slug=slug, owner_id=owner_id)
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    member = WorkspaceMember(workspace_id=workspace.id, user_id=owner_id, role="owner")
    db.add(member)
    db.commit()
    return workspace


def update(db: Session, workspace: Workspace, *, name: str | None = None) -> Workspace:
    if name is not None:
        workspace.name = name
    db.commit()
    db.refresh(workspace)
    return workspace


def delete(db: Session, workspace: Workspace) -> None:
    db.delete(workspace)
    db.commit()


def is_member(db: Session, workspace_id: UUID, user_id: UUID) -> bool:
    return (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
        .first()
        is not None
    )


def get_members(db: Session, workspace_id: UUID) -> List[WorkspaceMember]:
    return (
        db.query(WorkspaceMember)
        .options(joinedload(WorkspaceMember.user))
        .filter(WorkspaceMember.workspace_id == workspace_id)
        .all()
    )


def add_member(
    db: Session, workspace_id: UUID, user_id: UUID, role: str = "member"
) -> WorkspaceMember | None:
    if is_member(db, workspace_id, user_id):
        return None
    member = WorkspaceMember(workspace_id=workspace_id, user_id=user_id, role=role)
    db.add(member)
    db.commit()
    db.refresh(member)
    return member


def remove_member(db: Session, workspace_id: UUID, user_id: UUID) -> bool:
    member = (
        db.query(WorkspaceMember)
        .filter(
            WorkspaceMember.workspace_id == workspace_id,
            WorkspaceMember.user_id == user_id,
        )
        .first()
    )
    if not member:
        return False
    db.delete(member)
    db.commit()
    return True


def create_invitation(
    db: Session,
    *,
    workspace_id: UUID,
    email: str,
    invited_by: UUID,
    role: str = "member",
    expires_in_days: int = 7,
) -> WorkspaceInvitation:
    token = secrets.token_urlsafe(32)
    invitation = WorkspaceInvitation(
        workspace_id=workspace_id,
        email=email.strip().lower(),
        role=role,
        token=token,
        invited_by=invited_by,
        expires_at=datetime.now(timezone.utc) + timedelta(days=expires_in_days),
    )
    db.add(invitation)
    db.commit()
    db.refresh(invitation)
    return invitation


def get_invitation_by_token(db: Session, token: str) -> WorkspaceInvitation | None:
    return (
        db.query(WorkspaceInvitation)
        .options(joinedload(WorkspaceInvitation.workspace))
        .filter(WorkspaceInvitation.token == token)
        .first()
    )


def mark_invitation_accepted(db: Session, invitation: WorkspaceInvitation) -> WorkspaceInvitation:
    invitation.accepted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(invitation)
    return invitation


def list_workspace_invitations(
    db: Session,
    *,
    workspace_id: UUID,
    pending_only: bool = True,
) -> List[WorkspaceInvitation]:
    query = (
        db.query(WorkspaceInvitation)
        .options(joinedload(WorkspaceInvitation.workspace))
        .filter(WorkspaceInvitation.workspace_id == workspace_id)
    )
    if pending_only:
        query = query.filter(WorkspaceInvitation.accepted_at.is_(None))
    return query.order_by(WorkspaceInvitation.created_at.desc()).all()
