import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CreatedAtMixin, TimestampedMixin, UUIDMixin

if TYPE_CHECKING:
    from app.modules.elements.model import Element
    from app.modules.workspaces.model import Workspace


class Board(Base, UUIDMixin, TimestampedMixin):
    __tablename__ = "boards"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)

    workspace: Mapped["Workspace"] = relationship(
        "Workspace", back_populates="boards"
    )
    elements: Mapped[list["Element"]] = relationship(
        "Element", back_populates="board", cascade="all, delete-orphan"
    )

    # Dashboard lists boards sorted by last-updated; this index lets
    # the sort use the index directly instead of a filesort.
    __table_args__ = (
        Index("ix_boards_workspace_updated", "workspace_id", "updated_at"),
    )


class BoardStar(Base, UUIDMixin, CreatedAtMixin):
    """User-starred boards."""

    __tablename__ = "board_stars"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    board_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("boards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        UniqueConstraint("user_id", "board_id", name="uq_board_stars_user_board"),
    )


class BoardView(Base, UUIDMixin):
    """Tracks when a user last opened a board (drives the "Recent" view)."""

    __tablename__ = "board_views"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    board_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("boards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    last_opened_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "board_id", name="uq_board_views_user_board"),
    )


class BoardShareToken(Base, UUIDMixin, CreatedAtMixin):
    """Signed URL-style share link granting anonymous access to a board."""

    __tablename__ = "board_share_tokens"

    board_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("boards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    token: Mapped[str] = mapped_column(
        String(64), unique=True, nullable=False, index=True
    )
    # "viewer" (read-only) or "editor" (can draw).
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="viewer")
    # Keep the link valid if the creator deletes their account.
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class BoardComment(Base, UUIDMixin, TimestampedMixin):
    __tablename__ = "board_comments"

    board_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("boards.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Root comments have parent_id = None; replies point at the parent.
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("board_comments.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )
    # Nullable so a user's comments outlive their account.
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Optional anchor: either a scene-space point or a specific element id.
    anchor_x: Mapped[float | None] = mapped_column(Float, nullable=True)
    anchor_y: Mapped[float | None] = mapped_column(Float, nullable=True)
    anchor_element_id: Mapped[str | None] = mapped_column(String(64), nullable=True)

    body: Mapped[str] = mapped_column(Text, nullable=False)
    resolved_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class BoardTemplate(Base, UUIDMixin, CreatedAtMixin):
    __tablename__ = "board_templates"

    slug: Mapped[str] = mapped_column(
        String(80), unique=True, nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(160), nullable=False)
    category: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    # Storage key (preferred) or external URL (legacy) for the preview
    # image shown in the template picker.
    thumbnail_key: Mapped[str | None] = mapped_column(String(500), nullable=True)
    thumbnail_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_builtin: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="true"
    )
    # Full excalidraw_snapshot payload: {elements, appState}.
    snapshot: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
