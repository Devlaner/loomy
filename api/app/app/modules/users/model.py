import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CreatedAtMixin, TimestampedMixin, UUIDMixin

if TYPE_CHECKING:
    from app.modules.workspaces.model import WorkspaceMember


class User(Base, UUIDMixin, TimestampedMixin):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    username: Mapped[str] = mapped_column(
        String(100), unique=True, nullable=False, index=True
    )
    first_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    last_name: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Avatar sources, resolved in this order: `avatar_key` (presigned
    # URL from our storage) -> `avatar_url` (external OAuth CDN) ->
    # initials bubble in the UI.
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    avatar_key: Mapped[str | None] = mapped_column(String(500), nullable=True)

    hashed_password: Mapped[str | None] = mapped_column(String(255), nullable=True)

    email_verified: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    oauth_accounts: Mapped[list["OAuthAccount"]] = relationship(
        "OAuthAccount", back_populates="user", cascade="all, delete-orphan"
    )
    workspace_memberships: Mapped[list["WorkspaceMember"]] = relationship(
        "WorkspaceMember", back_populates="user"
    )


class OAuthAccount(Base, UUIDMixin, CreatedAtMixin):
    __tablename__ = "oauth_accounts"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    provider: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    provider_user_id: Mapped[str] = mapped_column(
        String(255), nullable=False, index=True
    )

    user: Mapped["User"] = relationship("User", back_populates="oauth_accounts")
