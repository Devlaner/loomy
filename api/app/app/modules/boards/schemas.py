from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class BoardCreate(BaseModel):
    name: str
    workspace_id: UUID


class BoardUpdate(BaseModel):
    name: str | None = None


class BoardResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    name: str
    owner_username: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BoardListResponse(BaseModel):
    items: list[BoardResponse]
    total: int
    page: int
    limit: int


class BoardWithMetaResponse(BoardResponse):
    """Board with optional last_opened_at and starred."""

    last_opened_at: datetime | None = None
    starred: bool = False
