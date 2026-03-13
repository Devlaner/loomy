from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.modules.boards.model import Board, BoardStar
from app.modules.workspaces.model import Workspace


def is_starred(db: Session, user_id: UUID, board_id: UUID) -> bool:
    return (
        db.query(BoardStar)
        .filter(
            BoardStar.user_id == user_id,
            BoardStar.board_id == board_id,
        )
        .first()
        is not None
    )


def star(db: Session, user_id: UUID, board_id: UUID) -> BoardStar:
    existing = (
        db.query(BoardStar)
        .filter(
            BoardStar.user_id == user_id,
            BoardStar.board_id == board_id,
        )
        .first()
    )
    if existing:
        return existing
    b = BoardStar(user_id=user_id, board_id=board_id)
    db.add(b)
    db.commit()
    db.refresh(b)
    return b


def unstar(db: Session, user_id: UUID, board_id: UUID) -> bool:
    b = (
        db.query(BoardStar)
        .filter(
            BoardStar.user_id == user_id,
            BoardStar.board_id == board_id,
        )
        .first()
    )
    if not b:
        return False
    db.delete(b)
    db.commit()
    return True


def get_starred_board_ids(db: Session, user_id: UUID) -> list[UUID]:
    return [r[0] for r in db.query(BoardStar.board_id).filter(BoardStar.user_id == user_id).all()]


def get_starred_boards(db: Session, user_id: UUID, limit: int = 50) -> list[Board]:
    """Return boards the user has starred, ordered by star created_at desc."""
    from app.modules.workspaces.repository import is_member as workspace_is_member

    rows = (
        db.query(Board)
        .join(BoardStar, BoardStar.board_id == Board.id)
        .options(joinedload(Board.workspace).joinedload(Workspace.owner))
        .filter(BoardStar.user_id == user_id)
        .order_by(BoardStar.created_at.desc())
        .limit(limit)
        .all()
    )
    return [b for b in rows if workspace_is_member(db, b.workspace_id, user_id)]
