from app.config import settings
from app.core.storage import is_enabled as storage_enabled, presign_get_url
from app.modules.users.model import User
from app.modules.users.schemas import PublicUserResponse, UserResponse


def display_name_of(user: User) -> str:
    first = (user.first_name or "").strip()
    last = (user.last_name or "").strip()
    if first or last:
        return f"{first} {last}".strip()
    if user.email:
        local = user.email.split("@", 1)[0]
        if local:
            return local
    return user.username or "Unknown"


def avatar_url_of(user: User) -> str | None:
    if user.avatar_key and storage_enabled():
        try:
            return presign_get_url(bucket=settings.s3_bucket, key=user.avatar_key)
        except Exception:
            return user.avatar_url
    return user.avatar_url


def to_user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        display_name=display_name_of(user),
        avatar_url=avatar_url_of(user),
        email_verified=user.email_verified,
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


def to_public_user_response(user: User) -> PublicUserResponse:
    return PublicUserResponse(
        id=user.id,
        username=user.username,
        display_name=display_name_of(user),
        avatar_url=avatar_url_of(user),
    )