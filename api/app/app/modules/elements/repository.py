from typing import Any
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.modules.elements.model import Element, ElementData


def get_by_id(db: Session, element_id: UUID) -> Element | None:
    return db.query(Element).filter(Element.id == element_id).first()


def get_by_board(
    db: Session, board_id: UUID, page: int = 1, limit: int = 100
) -> tuple[list[Element], int]:
    offset = (page - 1) * limit
    query = db.query(Element).filter(Element.board_id == board_id)
    total = db.query(func.count(Element.id)).filter(Element.board_id == board_id).scalar() or 0
    items = query.order_by(Element.created_at).offset(offset).limit(limit).all()
    return items, total


def create(db: Session, *, board_id: UUID, type: str, data: ElementData) -> Element:
    element = Element(board_id=board_id, type=type, data=data)
    db.add(element)
    db.commit()
    db.refresh(element)
    return element


def update(db: Session, element: Element, *, data: ElementData | None = None) -> Element:
    if data is not None:
        element.data = {**element.data, **data}
    db.commit()
    db.refresh(element)
    return element


def delete(db: Session, element: Element) -> None:
    db.delete(element)
    db.commit()


def bulk_update_data(db: Session, board_id: UUID, updates: list[dict[str, Any]]) -> int:
    """Update multiple elements' data. Each update: {id: uuid, data: dict}"""
    count = 0
    for item in updates:
        elem_id = item.get("id")
        data = item.get("data", {})
        if not elem_id or not data:
            continue
        element = get_by_id(db, elem_id)
        if element and element.board_id == board_id:
            element.data = {**element.data, **data}
            count += 1
    db.commit()
    return count
