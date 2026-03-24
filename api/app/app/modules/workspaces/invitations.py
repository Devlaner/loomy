from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from app.api.deps import get_current_user
from app.config import settings
from app.db.session import get_db
from app.modules.users.model import User
from app.modules.workspaces.schemas import (
    WorkspaceInvitationAcceptResponse,
    WorkspaceInvitationCreate,
    WorkspaceInvitationListResponse,
    WorkspaceInvitationResponse,
)
from app.modules.workspaces.service import (
    accept_workspace_invitation_for_user,
    create_workspace_invitation_for_user,
    get_workspace_invitation_by_token,
    list_workspace_invitations_for_user,
)

router = APIRouter(tags=["workspace-invitations"])


def _to_response(token: str, invitation) -> WorkspaceInvitationResponse:
    base_url = settings.frontend_url.rstrip("/") if settings.frontend_url else "http://localhost:5173"
    return WorkspaceInvitationResponse(
        id=invitation.id,
        workspace_id=invitation.workspace_id,
        workspace_name=invitation.workspace.name if invitation.workspace else "",
        email=invitation.email,
        role=invitation.role,
        token=token,
        invite_url=f"{base_url}/invite/{token}",
        created_at=invitation.created_at,
        expires_at=invitation.expires_at,
        accepted_at=invitation.accepted_at,
    )


@router.post(
    "/{workspace_id}/invitations",
    response_model=WorkspaceInvitationResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_workspace_invitation_endpoint(
    workspace_id: UUID,
    data: WorkspaceInvitationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkspaceInvitationResponse:
    invitation = create_workspace_invitation_for_user(
        db,
        workspace_id,
        current_user,
        email=data.email,
        role=data.role,
    )
    if invitation is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the workspace owner can create invitations",
        )
    loaded = get_workspace_invitation_by_token(db, invitation.token)
    if loaded is None:
        raise HTTPException(status_code=404, detail="Invitation not found")
    return _to_response(invitation.token, loaded)


@router.get(
    "/{workspace_id}/invitations",
    response_model=WorkspaceInvitationListResponse,
)
def list_workspace_invitations_endpoint(
    workspace_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkspaceInvitationListResponse:
    invitations = list_workspace_invitations_for_user(db, workspace_id, current_user)
    if invitations is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the workspace owner can view pending invitations",
        )
    return WorkspaceInvitationListResponse(
        items=[_to_response(invitation.token, invitation) for invitation in invitations]
    )


@router.get("/invitations/{token}", response_model=WorkspaceInvitationResponse)
def get_workspace_invitation_endpoint(
    token: str,
    db: Session = Depends(get_db),
) -> WorkspaceInvitationResponse:
    invitation = get_workspace_invitation_by_token(db, token)
    if invitation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    return _to_response(token, invitation)


@router.post(
    "/invitations/{token}/accept",
    response_model=WorkspaceInvitationAcceptResponse,
)
def accept_workspace_invitation_endpoint(
    token: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkspaceInvitationAcceptResponse:
    invitation = accept_workspace_invitation_for_user(db, token, current_user)
    if invitation is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation is invalid, expired, already used, or email does not match",
        )
    return WorkspaceInvitationAcceptResponse(
        workspace_id=invitation.workspace_id,
        workspace_name=invitation.workspace.name if invitation.workspace else "",
    )
