from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.boards.model import BoardComment


def create(
    db: Session,
    *,
    board_id: UUID,
    author_id: UUID,
    body: str,
    parent_id: UUID | None = None,
    anchor_x: float | None = None,
    anchor_y: float | None = None,
    anchor_element_id: str | None = None,
) -> BoardComment:
    row = BoardComment(
        board_id=board_id,
        author_id=author_id,
        body=body,
        parent_id=parent_id,
        anchor_x=anchor_x,
        anchor_y=anchor_y,
        anchor_element_id=anchor_element_id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_for_board(db: Session, board_id: UUID) -> list[BoardComment]:
    stmt = (
        select(BoardComment)
        .where(BoardComment.board_id == board_id)
        .order_by(BoardComment.created_at)
    )
    return list(db.execute(stmt).scalars().all())


def get_by_id(db: Session, comment_id: UUID) -> BoardComment | None:
    return db.get(BoardComment, comment_id)


def update(
    db: Session,
    row: BoardComment,
    *,
    body: str | None = None,
    resolved: bool | None = None,
) -> BoardComment:
    if body is not None:
        row.body = body
    if resolved is True and row.resolved_at is None:
        row.resolved_at = datetime.now(timezone.utc)
    elif resolved is False:
        row.resolved_at = None
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def delete(db: Session, row: BoardComment) -> None:
    db.delete(row)
    db.commit()
