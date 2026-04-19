from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.modules.users.model import User
from app.modules.workspaces.model import Workspace
from app.modules.workspaces.schemas import (
    WorkspaceCreate,
    WorkspaceListResponse,
    WorkspaceResponse,
    WorkspaceUpdate,
)
from app.modules.workspaces.service import (
    create_workspace_for_user,
    delete_workspace_for_user,
    get_workspace,
    list_workspaces,
    update_workspace_for_user,
)
from app.modules.workspaces.members import router as members_router
from app.modules.workspaces.invitations import router as invitations_router

router = APIRouter(prefix="/workspaces", tags=["workspaces"])
router.include_router(members_router, prefix="/{workspace_id}")
router.include_router(invitations_router)


def _workspace_to_response(workspace: Workspace) -> WorkspaceResponse:
    from app.modules.users.presenter import avatar_url_of, display_name_of

    owner = workspace.owner
    data = {
        "id": workspace.id,
        "name": workspace.name,
        "slug": workspace.slug,
        "owner_id": workspace.owner_id,
        "owner_username": owner.username if owner else None,
        "owner_display_name": display_name_of(owner) if owner else None,
        "owner_avatar_url": avatar_url_of(owner) if owner else None,
        "created_at": workspace.created_at,
        "updated_at": workspace.updated_at,
    }
    return WorkspaceResponse.model_validate(data)


@router.get("", response_model=WorkspaceListResponse)
def list_workspaces_endpoint(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkspaceListResponse:
    items, total = list_workspaces(db, current_user, page, limit)
    return WorkspaceListResponse(
        items=[_workspace_to_response(w) for w in items],
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/{workspace_id}", response_model=WorkspaceResponse)
def get_workspace_endpoint(
    workspace_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkspaceResponse:
    workspace = get_workspace(db, workspace_id, current_user)
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found",
        )
    return _workspace_to_response(workspace)


@router.post("", response_model=WorkspaceResponse, status_code=status.HTTP_201_CREATED)
def create_workspace_endpoint(
    data: WorkspaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkspaceResponse:
    workspace = create_workspace_for_user(db, current_user, data)
    loaded = get_workspace(db, workspace.id, current_user)
    # loaded should not be None immediately after creation, but guard for mypy
    if loaded is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found after creation",
        )
    return _workspace_to_response(loaded)


@router.patch("/{workspace_id}", response_model=WorkspaceResponse)
def update_workspace_endpoint(
    workspace_id: UUID,
    data: WorkspaceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkspaceResponse:
    workspace = update_workspace_for_user(db, workspace_id, current_user, data)
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or unauthorized",
        )
    return _workspace_to_response(workspace)


@router.delete("/{workspace_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_workspace_endpoint(
    workspace_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    if not delete_workspace_for_user(db, workspace_id, current_user):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace not found or unauthorized",
        )
