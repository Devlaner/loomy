import secrets
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.boards.model import BoardShareToken


def create(
    db: Session,
    *,
    board_id: UUID,
    role: str,
    created_by: UUID,
    expires_at: datetime | None = None,
) -> BoardShareToken:
    row = BoardShareToken(
        board_id=board_id,
        token=secrets.token_urlsafe(32),
        role=role,
        created_by=created_by,
        expires_at=expires_at,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def list_for_board(db: Session, board_id: UUID) -> list[BoardShareToken]:
    stmt = (
        select(BoardShareToken)
        .where(BoardShareToken.board_id == board_id)
        .where(BoardShareToken.revoked_at.is_(None))
        .order_by(BoardShareToken.created_at.desc())
    )
    return list(db.execute(stmt).scalars().all())


def get_by_token(db: Session, token: str) -> BoardShareToken | None:
    stmt = select(BoardShareToken).where(BoardShareToken.token == token)
    return db.execute(stmt).scalars().first()


def get_by_id(db: Session, share_id: UUID) -> BoardShareToken | None:
    return db.get(BoardShareToken, share_id)


def revoke(db: Session, row: BoardShareToken) -> BoardShareToken:
    row.revoked_at = datetime.now(timezone.utc)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def is_usable(row: BoardShareToken, now: datetime | None = None) -> bool:
    ts = now or datetime.now(timezone.utc)
    if row.revoked_at is not None:
        return False
    if row.expires_at is not None and row.expires_at <= ts:
        return False
    return True
