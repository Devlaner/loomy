from datetime import datetime
from typing import Any, Dict, List
from uuid import UUID

from pydantic import BaseModel

ElementData = Dict[str, Any]


class ElementCreate(BaseModel):
    board_id: UUID
    type: str  # shape, sticky_note, text, arrow, connector
    data: ElementData = {}


class ElementUpdate(BaseModel):
    data: ElementData | None = None


class ElementResponse(BaseModel):
    id: UUID
    board_id: UUID
    type: str
    data: ElementData
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ElementListResponse(BaseModel):
    items: list[ElementResponse]
    total: int
    page: int
    limit: int


class ElementBulkUpdate(BaseModel):
    board_id: UUID
    updates: List[ElementData]  # [{"id": "uuid", "data": {...}}]


class SnapshotUpsert(BaseModel):
    board_id: UUID
    data: ElementData = {}
