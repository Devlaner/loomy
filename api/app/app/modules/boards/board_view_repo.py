from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session, joinedload

from app.modules.boards.model import Board, BoardView
from app.modules.workspaces.model import Workspace


def record_open(db: Session, user_id: UUID, board_id: UUID) -> None:
    existing = (
        db.query(BoardView)
        .filter(
            BoardView.user_id == user_id,
            BoardView.board_id == board_id,
        )
        .first()
    )
    if existing:
        existing.last_opened_at = datetime.now(timezone.utc)
        db.commit()
    else:
        bv = BoardView(user_id=user_id, board_id=board_id)
        db.add(bv)
        db.commit()


def get_recent_boards(db: Session, user_id: UUID, limit: int = 50) -> list[tuple[Board, datetime]]:
    """Return (board, last_opened_at) for boards user recently opened, ordered by last_opened_at desc."""
    from app.modules.workspaces.repository import is_member as workspace_is_member

    rows = (
        db.query(Board, BoardView.last_opened_at)
        .join(BoardView, BoardView.board_id == Board.id)
        .options(joinedload(Board.workspace).joinedload(Workspace.owner))
        .filter(BoardView.user_id == user_id)
        .order_by(BoardView.last_opened_at.desc())
        .limit(limit)
        .all()
    )
    result = []
    for board, last_opened in rows:
        if workspace_is_member(db, board.workspace_id, user_id):
            result.append((board, last_opened))
    return result
