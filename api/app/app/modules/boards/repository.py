from typing import Tuple, List
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.modules.boards.model import Board
from app.modules.workspaces.model import Workspace


def get_by_id(db: Session, board_id: UUID) -> Board | None:
    return (
        db.query(Board)
        .options(joinedload(Board.workspace).joinedload(Workspace.owner))
        .filter(Board.id == board_id)
        .first()
    )


def get_by_workspace(
    db: Session, workspace_id: UUID, page: int = 1, limit: int = 20
) -> Tuple[List[Board], int]:
    offset = (page - 1) * limit
    query = (
        db.query(Board)
        .options(joinedload(Board.workspace).joinedload(Workspace.owner))
        .filter(Board.workspace_id == workspace_id)
    )
    total = db.query(func.count(Board.id)).filter(Board.workspace_id == workspace_id).scalar() or 0
    items = query.order_by(Board.updated_at.desc()).offset(offset).limit(limit).all()
    return items, total


def create(db: Session, *, name: str, workspace_id: UUID) -> Board:
    board = Board(name=name, workspace_id=workspace_id)
    db.add(board)
    db.commit()
    db.refresh(board)
    return board


def update(db: Session, board: Board, *, name: str | None = None) -> Board:
    if name is not None:
        board.name = name
    db.commit()
    db.refresh(board)
    return board


def delete(db: Session, board: Board) -> None:
    db.delete(board)
    db.commit()
