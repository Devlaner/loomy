from typing import Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.boards.model import Board
from app.modules.boards.repository import (
    create as create_board,
    delete as delete_board,
    get_by_id,
    get_by_workspace,
    update as update_board,
)
from app.modules.boards.schemas import BoardCreate, BoardUpdate
from app.modules.users.model import User
from app.modules.workspaces.repository import is_member as workspace_is_member


def get_board(db: Session, board_id: UUID, user: User) -> Board | None:
    board = get_by_id(db, board_id)
    if not board:
        return None
    if not workspace_is_member(db, board.workspace_id, user.id):
        return None
    return board


def list_boards(
    db: Session, workspace_id: UUID, user: User, page: int = 1, limit: int = 20
) -> Tuple[list[Board], int]:
    if not workspace_is_member(db, workspace_id, user.id):
        return [], 0
    return get_by_workspace(db, workspace_id, page, limit)


def create_board_for_user(db: Session, user: User, data: BoardCreate) -> Board | None:
    if not workspace_is_member(db, data.workspace_id, user.id):
        return None
    return create_board(db, name=data.name, workspace_id=data.workspace_id)


def update_board_for_user(
    db: Session, board_id: UUID, user: User, data: BoardUpdate
) -> Board | None:
    board = get_board(db, board_id, user)
    if not board:
        return None
    return update_board(db, board, name=data.name)


def delete_board_for_user(db: Session, board_id: UUID, user: User) -> bool:
    board = get_board(db, board_id, user)
    if not board:
        return False
    delete_board(db, board)
    return True


def duplicate_board_for_user(db: Session, board_id: UUID, user: User) -> Board | None:
    from app.modules.elements.repository import get_by_board, create as create_element

    board = get_board(db, board_id, user)
    if not board:
        return None
    new_board = create_board(
        db,
        name=f"{board.name} (copy)",
        workspace_id=board.workspace_id,
    )
    elements, _ = get_by_board(db, board_id, page=1, limit=500)
    for elem in elements:
        create_element(db, board_id=new_board.id, type=elem.type, data=dict(elem.data))
    return new_board
