import logging
import secrets
from dataclasses import dataclass
from uuid import UUID

from sqlalchemy.orm import Session

from app.config import settings
from app.core.email import send_email
from app.core.redis import get_redis
from app.core.security import hash_password
from app.modules.users.model import User
from app.modules.users.repository import get_by_email, get_by_id

logger = logging.getLogger(__name__)

RESET_PREFIX = "pwreset:"


@dataclass(frozen=True)
class PasswordResetResult:
    ok: bool
    user_id: str | None = None


def _ttl_seconds() -> int:
    return settings.password_reset_expire_minutes * 60


def _build_reset_url(token: str) -> str:
    return f"{settings.frontend_url.rstrip('/')}/reset-password?token={token}"


def request_password_reset(db: Session, email: str) -> None:
    # Silent when the account doesn't exist so the endpoint isn't a
    # user-enumeration oracle.
    user = get_by_email(db, email)
    if not user or not user.email:
        return

    token = secrets.token_urlsafe(48)
    try:
        get_redis().setex(f"{RESET_PREFIX}{token}", _ttl_seconds(), str(user.id))
    except Exception as exc:
        logger.error("Failed to store password reset token: %s", exc)
        return

    _send_reset_email(user, _build_reset_url(token))


def _send_reset_email(user: User, reset_url: str) -> None:
    subject = "Reset your Loomy password"
    text = (
        f"Hi {user.username or user.email},\n\n"
        "Someone asked to reset your Loomy password. "
        "Open this link within "
        f"{settings.password_reset_expire_minutes} minutes to pick a new one:\n\n"
        f"{reset_url}\n\n"
        "If this wasn't you, ignore this message."
    )
    send_email(to=user.email, subject=subject, text=text)


def consume_password_reset(
    db: Session, token: str, new_password: str
) -> PasswordResetResult:
    key = f"{RESET_PREFIX}{token}"
    try:
        redis = get_redis()
        stored = redis.get(key)
        if stored is None:
            return PasswordResetResult(ok=False)
        redis.delete(key)
    except Exception as exc:
        logger.error("Failed to read/delete password reset token: %s", exc)
        return PasswordResetResult(ok=False)

    if isinstance(stored, bytes):
        stored = stored.decode("utf-8", errors="replace")
    user_id_str = str(stored)

    try:
        user_uuid = UUID(user_id_str)
    except ValueError:
        return PasswordResetResult(ok=False)

    user = get_by_id(db, user_uuid)
    if not user:
        return PasswordResetResult(ok=False)

    user.hashed_password = hash_password(new_password)
    db.add(user)
    db.commit()
    return PasswordResetResult(ok=True, user_id=user_id_str)
