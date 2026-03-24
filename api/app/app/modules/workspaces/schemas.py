from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class WorkspaceCreate(BaseModel):
    name: str


class WorkspaceUpdate(BaseModel):
    name: str | None = None


class WorkspaceResponse(BaseModel):
    id: UUID
    name: str
    slug: str
    owner_id: UUID
    owner_username: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceListResponse(BaseModel):
    items: list[WorkspaceResponse]
    total: int
    page: int
    limit: int


class WorkspaceInvitationCreate(BaseModel):
    email: str
    role: str = "member"


class WorkspaceInvitationResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    workspace_name: str
    email: str
    role: str
    token: str
    invite_url: str
    created_at: datetime
    expires_at: datetime | None = None
    accepted_at: datetime | None = None


class WorkspaceInvitationAcceptResponse(BaseModel):
    workspace_id: UUID
    workspace_name: str


class WorkspaceInvitationListResponse(BaseModel):
    items: list[WorkspaceInvitationResponse]
