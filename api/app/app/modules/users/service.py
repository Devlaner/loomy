from uuid import UUID

from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.modules.users.model import User
from app.modules.users.repository import create as create_user
from app.modules.users.repository import get_by_email
from app.modules.users.repository import get_by_id
from app.modules.users.repository import get_by_username
from app.modules.users.repository import update as update_user
from app.modules.users.schemas import UserCreate, UserUpdate
from app.modules.workspaces.service import create_default_workspace_for_user


def get_user_by_id(db: Session, user_id: UUID) -> User | None:
    return get_by_id(db, user_id)


def register_user(db: Session, data: UserCreate) -> User:
    if get_by_email(db, data.email):
        raise ValueError("Email already registered")
    if get_by_username(db, data.username):
        raise ValueError("Username already taken")
    user = create_user(
        db,
        email=data.email,
        username=data.username,
        hashed_password=hash_password(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
    )
    create_default_workspace_for_user(db, user, data.first_name, data.last_name)
    return user


def update_user_profile(
    db: Session, user_id: UUID, data: UserUpdate, current_user_id: UUID
) -> User | None:
    """Update user profile. Users can only update their own profile."""
    if user_id != current_user_id:
        return None
    user = get_by_id(db, user_id)
    if not user:
        return None
    if data.username is not None:
        existing = get_by_username(db, data.username)
        if existing and existing.id != user_id:
            raise ValueError("Username already taken")
    return update_user(
        db,
        user,
        username=data.username,
        first_name=data.first_name,
        last_name=data.last_name,
        avatar_url=data.avatar_url,
    )
