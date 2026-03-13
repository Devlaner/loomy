from typing import Any, Dict, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.boards.repository import get_by_id as get_board
from app.modules.elements.model import Element
from app.modules.elements.repository import (
    bulk_update_data,
    create as create_element,
    delete as delete_element,
    get_by_id,
    get_by_board,
    update as update_element,
)
from app.modules.elements.schemas import ElementCreate, ElementUpdate
from app.modules.users.model import User
from app.modules.workspaces.repository import is_member as workspace_is_member

VALID_TYPES = {"shape", "sticky_note", "text", "arrow", "connector", "tldraw_snapshot"}


def get_element(db: Session, element_id: UUID, user: User) -> Element | None:
    element = get_by_id(db, element_id)
    if not element:
        return None
    board = get_board(db, element.board_id)
    if not board or not workspace_is_member(db, board.workspace_id, user.id):
        return None
    return element


def list_elements(
    db: Session, board_id: UUID, user: User, page: int = 1, limit: int = 100
) -> Tuple[list[Element], int]:
    board = get_board(db, board_id)
    if not board or not workspace_is_member(db, board.workspace_id, user.id):
        return [], 0
    return get_by_board(db, board_id, page, limit)


def create_element_for_user(
    db: Session, board_id: UUID, user: User, data: ElementCreate
) -> Element | None:
    board = get_board(db, board_id)
    if not board or not workspace_is_member(db, board.workspace_id, user.id):
        return None
    if data.type not in VALID_TYPES:
        return None
    return create_element(db, board_id=board_id, type=data.type, data=data.data)


def update_element_for_user(
    db: Session, element_id: UUID, user: User, data: ElementUpdate
) -> Element | None:
    element = get_element(db, element_id, user)
    if not element:
        return None
    return update_element(db, element, data=data.data)


def delete_element_for_user(db: Session, element_id: UUID, user: User) -> bool:
    element = get_element(db, element_id, user)
    if not element:
        return False
    delete_element(db, element)
    return True


def bulk_update_elements(
    db: Session, board_id: UUID, user: User, updates: list[Dict[str, Any]]
) -> int | None:
    board = get_board(db, board_id)
    if not board or not workspace_is_member(db, board.workspace_id, user.id):
        return None
    return bulk_update_data(db, board_id, updates)
