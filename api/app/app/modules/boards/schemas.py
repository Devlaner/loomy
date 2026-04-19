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
    # Kept for backwards compatibility with older clients. New UI code
    # should display `owner_display_name` instead.
    owner_username: str | None = None
    owner_display_name: str | None = None
    owner_avatar_url: str | None = None
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


class ShareTokenCreate(BaseModel):
    role: str = "viewer"
    expires_at: datetime | None = None


class ShareTokenResponse(BaseModel):
    id: UUID
    board_id: UUID
    token: str
    url: str
    role: str
    created_at: datetime
    expires_at: datetime | None = None

    model_config = {"from_attributes": True}


class ShareTokenListResponse(BaseModel):
    items: list[ShareTokenResponse]


class PublicBoardResponse(BaseModel):
    """Metadata a share-link viewer/editor needs to render the board."""

    id: UUID
    name: str
    role: str


class CommentCreate(BaseModel):
    body: str
    parent_id: UUID | None = None
    anchor_x: float | None = None
    anchor_y: float | None = None
    anchor_element_id: str | None = None


class CommentUpdate(BaseModel):
    body: str | None = None
    resolved: bool | None = None


class CommentResponse(BaseModel):
    id: UUID
    board_id: UUID
    parent_id: UUID | None = None
    author_id: UUID | None = None
    author_username: str | None = None
    author_display_name: str | None = None
    author_avatar_url: str | None = None
    anchor_x: float | None = None
    anchor_y: float | None = None
    anchor_element_id: str | None = None
    body: str
    resolved_at: datetime | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CommentListResponse(BaseModel):
    items: list[CommentResponse]


class TemplateResponse(BaseModel):
    id: UUID
    slug: str
    name: str
    category: str
    description: str
    thumbnail_url: str | None = None

    model_config = {"from_attributes": True}


class TemplateListResponse(BaseModel):
    items: list[TemplateResponse]


class BoardCreateFromTemplate(BaseModel):
    workspace_id: UUID
    template_slug: str
    name: str | None = None


class BoardSearchResponse(BaseModel):
    items: list[BoardResponse]
