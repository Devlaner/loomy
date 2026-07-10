from typing import TYPE_CHECKING, Any, Dict, Tuple

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.jwt import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
)
from app.core.security import verify_password
from app.core.token_store import (
    is_refresh_jti_valid,
    revoke_refresh_jti,
    store_refresh_jti,
)
from app.modules.auth.repository import get_user_for_auth
from app.modules.auth.schemas import LoginRequest, Token
from app.modules.users.repository import create as create_user
from app.modules.users.repository import (
    create_oauth_account,
    get_by_email,
    get_by_oauth,
    get_by_username,
)
from app.modules.workspaces.service import create_default_workspace_for_user

if TYPE_CHECKING:
    from app.modules.users.model import User


def issue_token_pair(user_id: str) -> Token:
    access = create_access_token(subject=user_id)
    refresh, jti = create_refresh_token(subject=user_id)
    store_refresh_jti(user_id, jti)
    return Token(access_token=access, refresh_token=refresh)


def login(db: Session, data: LoginRequest) -> Token | None:
    user = get_user_for_auth(db, data.email)
    if not user or not user.hashed_password:
        return None
    if not verify_password(data.password, user.hashed_password):
        return None
    return issue_token_pair(str(user.id))


def rotate_refresh_token(refresh_token: str) -> Token | None:
    decoded = decode_refresh_token(refresh_token)
    if decoded is None:
        return None
    user_id, jti = decoded
    if not is_refresh_jti_valid(jti, user_id):
        return None
    revoke_refresh_jti(jti)
    return issue_token_pair(user_id)


def logout(refresh_token: str | None) -> None:
    if not refresh_token:
        return
    decoded = decode_refresh_token(refresh_token)
    if decoded is None:
        return
    _, jti = decoded
    revoke_refresh_jti(jti)


def get_or_create_oauth_user(
    db: Session, info: Dict[str, Any]
) -> Tuple["User", bool]:
    from datetime import datetime, timezone

    user = get_by_oauth(db, info["provider"], info["provider_user_id"])
    if user:
        return user, False

    # Only link to an existing account by email when the provider itself
    # attests the email is verified. Both GitHub and Google allow an
    # account to hold an *unverified* email address; trusting that here
    # would let an attacker add a victim's email to their own OAuth
    # account and log in as the victim. An unverified/synthetic email
    # always falls through to creating a brand-new account below instead.
    email_verified = bool(info.get("email_verified"))
    user = get_by_email(db, info["email"]) if email_verified else None
    if user:
        create_oauth_account(
            db,
            user_id=user.id,
            provider=info["provider"],
            provider_user_id=info["provider_user_id"],
        )
        # OAuth provider already verified this email; mark it so.
        if not user.email_verified:
            user.email_verified = True
            user.email_verified_at = datetime.now(timezone.utc)
            db.add(user)
            db.commit()
        return user, False

    base_username = info["username"]
    username = base_username
    counter = 0
    while get_by_username(db, username):
        counter += 1
        username = f"{base_username}{counter}"

    first_name = info.get("first_name")
    last_name = info.get("last_name")

    try:
        user = create_user(
            db,
            email=info["email"],
            username=username,
            hashed_password=None,
            avatar_url=info.get("avatar_url"),
            first_name=first_name,
            last_name=last_name,
        )
    except IntegrityError:
        # Only reachable when info["email"] wasn't verified (verified
        # emails would have matched via get_by_email above) and happens
        # to collide with an existing account's email. Refuse instead of
        # silently creating a duplicate-email row or linking unverified.
        db.rollback()
        raise ValueError(
            "An account with this email already exists. Sign in with "
            "your password, or verify this email with the provider "
            "before linking."
        ) from None

    if email_verified:
        user.email_verified = True
        user.email_verified_at = datetime.now(timezone.utc)
        db.add(user)
        db.commit()

    create_oauth_account(
        db,
        user_id=user.id,
        provider=info["provider"],
        provider_user_id=info["provider_user_id"],
    )
    create_default_workspace_for_user(db, user, first_name, last_name)
    return user, True
