from typing import TYPE_CHECKING, Dict, Any, Tuple

from sqlalchemy.orm import Session

from app.core.jwt import create_access_token
from app.core.security import verify_password
from app.modules.auth.repository import get_user_for_auth
from app.modules.auth.schemas import LoginRequest, Token
from app.modules.users.repository import create as create_user
from app.modules.users.repository import create_oauth_account
from app.modules.users.repository import get_by_email
from app.modules.users.repository import get_by_oauth
from app.modules.users.repository import get_by_username
from app.modules.workspaces.service import create_default_workspace_for_user

if TYPE_CHECKING:
    from app.modules.users.model import User


def login(db: Session, data: LoginRequest) -> Token | None:
    user = get_user_for_auth(db, data.email)
    if not user or not user.hashed_password:
        return None
    if not verify_password(data.password, user.hashed_password):
        return None
    return Token(access_token=create_access_token(subject=str(user.id)))


def get_or_create_oauth_user(db: Session, info: Dict[str, Any]) -> Tuple["User", bool]:
    """Returns (user, is_new)."""
    user = get_by_oauth(db, info["provider"], info["provider_user_id"])
    if user:
        return user, False

    # Check if email exists - link account
    user = get_by_email(db, info["email"])
    if user:
        create_oauth_account(
            db,
            user_id=user.id,
            provider=info["provider"],
            provider_user_id=info["provider_user_id"],
        )
        return user, False

    # Create new user - ensure unique username
    base_username = info["username"]
    username = base_username
    counter = 0
    while get_by_username(db, username):
        counter += 1
        username = f"{base_username}{counter}"

    first_name = info.get("first_name") or "User"
    last_name = info.get("last_name") or ""

    user = create_user(
        db,
        email=info["email"],
        username=username,
        hashed_password=None,
        avatar_url=info.get("avatar_url"),
        first_name=first_name,
        last_name=last_name,
    )
    create_oauth_account(
        db,
        user_id=user.id,
        provider=info["provider"],
        provider_user_id=info["provider_user_id"],
    )
    create_default_workspace_for_user(db, user, first_name, last_name)
    return user, True
