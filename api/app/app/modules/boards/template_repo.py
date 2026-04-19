from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.boards.model import BoardTemplate


def list_all(db: Session) -> list[BoardTemplate]:
    stmt = select(BoardTemplate).order_by(
        BoardTemplate.category, BoardTemplate.name
    )
    return list(db.execute(stmt).scalars().all())


def get_by_slug(db: Session, slug: str) -> BoardTemplate | None:
    stmt = select(BoardTemplate).where(BoardTemplate.slug == slug)
    return db.execute(stmt).scalars().first()


def get_by_id(db: Session, template_id: UUID) -> BoardTemplate | None:
    return db.get(BoardTemplate, template_id)


def upsert(
    db: Session,
    *,
    slug: str,
    name: str,
    category: str,
    description: str,
    snapshot: dict[str, object],
    thumbnail_url: str | None = None,
) -> BoardTemplate:
    existing = get_by_slug(db, slug)
    if existing:
        existing.name = name
        existing.category = category
        existing.description = description
        existing.snapshot = snapshot
        if thumbnail_url is not None:
            existing.thumbnail_url = thumbnail_url
        db.add(existing)
        db.commit()
        db.refresh(existing)
        return existing
    row = BoardTemplate(
        slug=slug,
        name=name,
        category=category,
        description=description,
        snapshot=snapshot,
        thumbnail_url=thumbnail_url,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row
