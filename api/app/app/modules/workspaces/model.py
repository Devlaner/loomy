import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, CreatedAtMixin, TimestampedMixin, UUIDMixin

if TYPE_CHECKING:
    from app.modules.boards.model import Board
    from app.modules.users.model import User


class Workspace(Base, UUIDMixin, TimestampedMixin):
    __tablename__ = "workspaces"

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    owner_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )

    owner: Mapped["User"] = relationship(
        "User", foreign_keys=[owner_id], backref="owned_workspaces"
    )
    boards: Mapped[list["Board"]] = relationship(
        "Board", back_populates="workspace", cascade="all, delete-orphan"
    )
    members: Mapped[list["WorkspaceMember"]] = relationship(
        "WorkspaceMember", back_populates="workspace", cascade="all, delete-orphan"
    )
    invitations: Mapped[list["WorkspaceInvitation"]] = relationship(
        "WorkspaceInvitation",
        back_populates="workspace",
        cascade="all, delete-orphan",
    )


class WorkspaceMember(Base, UUIDMixin, CreatedAtMixin):
    __tablename__ = "workspace_members"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="member")

    workspace: Mapped["Workspace"] = relationship(
        "Workspace", back_populates="members"
    )
    user: Mapped["User"] = relationship(
        "User", back_populates="workspace_memberships"
    )


class WorkspaceInvitation(Base, UUIDMixin, CreatedAtMixin):
    __tablename__ = "workspace_invitations"

    workspace_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(50), nullable=False, default="member")
    token: Mapped[str] = mapped_column(
        String(128), nullable=False, unique=True, index=True
    )
    # Keep the invite intact if the inviter later deletes their account.
    invited_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    workspace: Mapped["Workspace"] = relationship(
        "Workspace", back_populates="invitations"
    )
