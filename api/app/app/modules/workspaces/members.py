"""Workspace members sub-router."""

from typing import Any, Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.modules.users.model import User
from app.modules.users.repository import get_by_email
from app.modules.workspaces.model import WorkspaceMember
from app.modules.workspaces.repository import (
    add_member as repo_add_member,
    get_members,
    remove_member as repo_remove_member,
)
from app.modules.workspaces.service import get_workspace as get_workspace_for_user

router = APIRouter(prefix="/members", tags=["workspace-members"])


def _member_response(member: WorkspaceMember) -> Dict[str, Any]:
    from app.modules.users.presenter import avatar_url_of, display_name_of

    user = member.user
    return {
        "id": str(member.user_id),
        "user_id": str(member.user_id),
        "username": user.username if user else None,
        "display_name": display_name_of(user) if user else None,
        "email": user.email if user else None,
        "avatar_url": avatar_url_of(user) if user else None,
        "role": member.role,
    }


class InviteMemberSchema(BaseModel):
    email: str | None = None
    user_id: UUID | None = None
    role: str = "member"


@router.get("")
def list_members(
    workspace_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    workspace = get_workspace_for_user(db, workspace_id, current_user)
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )
    members = get_members(db, workspace_id)
    return {"items": [_member_response(m) for m in members]}


@router.post("", status_code=status.HTTP_201_CREATED)
def invite_member(
    workspace_id: UUID,
    data: InviteMemberSchema,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Dict[str, str]:
    workspace = get_workspace_for_user(db, workspace_id, current_user)
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )
    if workspace.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the workspace owner can invite members",
        )
    target_user_id = data.user_id
    if not target_user_id and data.email:
        user = get_by_email(db, data.email)
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No user found with this email",
            )
        target_user_id = user.id
    if not target_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Provide email or user_id",
        )
    member = repo_add_member(db, workspace_id, target_user_id, role=data.role)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member",
        )
    return {"user_id": str(target_user_id), "role": data.role}


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    workspace_id: UUID,
    user_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    workspace = get_workspace_for_user(db, workspace_id, current_user)
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )
    if workspace.owner_id != current_user.id and current_user.id != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the owner can remove others; members can leave themselves",
        )
    if workspace.owner_id == user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove the workspace owner",
        )
    if not repo_remove_member(db, workspace_id, user_id):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found",
        )
