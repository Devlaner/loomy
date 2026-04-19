import logging
import secrets
from dataclasses import dataclass
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.config import settings
from app.core.email import send_email
from app.core.redis import get_redis
from app.modules.users.model import User
from app.modules.users.repository import get_by_email, get_by_id

logger = logging.getLogger(__name__)

VERIFY_PREFIX = "email_verify:"
VERIFY_TTL_SECONDS = 48 * 60 * 60


@dataclass(frozen=True)
class VerificationResult:
    ok: bool
    user_id: str | None = None


def _build_verify_url(token: str) -> str:
    return f"{settings.frontend_url.rstrip('/')}/verify-email?token={token}"


def request_email_verification(db: Session, email: str) -> None:
    user = get_by_email(db, email)
    if not user or not user.email:
        return
    if user.email_verified:
        return
    token = secrets.token_urlsafe(48)
    try:
        get_redis().setex(
            f"{VERIFY_PREFIX}{token}", VERIFY_TTL_SECONDS, str(user.id)
        )
    except Exception as exc:
        logger.error("Failed to store email verification token: %s", exc)
        return
    _send_verification_email(user, _build_verify_url(token))


def send_verification_for_user(user: User) -> None:
    if not user.email or user.email_verified:
        return
    token = secrets.token_urlsafe(48)
    try:
        get_redis().setex(
            f"{VERIFY_PREFIX}{token}", VERIFY_TTL_SECONDS, str(user.id)
        )
    except Exception as exc:
        logger.error("Failed to store email verification token: %s", exc)
        return
    _send_verification_email(user, _build_verify_url(token))


def _send_verification_email(user: User, verify_url: str) -> None:
    subject = "Verify your Loomy email"
    text = (
        f"Hi {user.username or user.email},\n\n"
        "Confirm your email to finish setting up your Loomy account:\n\n"
        f"{verify_url}\n\n"
        "The link expires in 48 hours."
    )
    send_email(to=user.email, subject=subject, text=text)


def confirm_email_verification(db: Session, token: str) -> VerificationResult:
    key = f"{VERIFY_PREFIX}{token}"
    try:
        redis = get_redis()
        stored = redis.get(key)
        if stored is None:
            return VerificationResult(ok=False)
        redis.delete(key)
    except Exception as exc:
        logger.error("Failed to read email verification token: %s", exc)
        return VerificationResult(ok=False)

    if isinstance(stored, bytes):
        stored = stored.decode("utf-8", errors="replace")
    user_id_str = str(stored)
    try:
        user_uuid = UUID(user_id_str)
    except ValueError:
        return VerificationResult(ok=False)

    user = get_by_id(db, user_uuid)
    if not user:
        return VerificationResult(ok=False)

    user.email_verified = True
    user.email_verified_at = datetime.now(timezone.utc)
    db.add(user)
    db.commit()
    return VerificationResult(ok=True, user_id=user_id_str)
