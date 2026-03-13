from uuid import UUID

from sqlalchemy.orm import Session

from app.modules.users.model import OAuthAccount, User


def get_by_id(db: Session, user_id: UUID) -> User | None:
    return db.query(User).filter(User.id == user_id).first()


def get_by_email(db: Session, email: str) -> User | None:
    return db.query(User).filter(User.email == email).first()


def get_by_username(db: Session, username: str) -> User | None:
    return db.query(User).filter(User.username == username).first()


def get_by_oauth(db: Session, provider: str, provider_user_id: str) -> User | None:
    oauth = (
        db.query(OAuthAccount)
        .filter(
            OAuthAccount.provider == provider,
            OAuthAccount.provider_user_id == provider_user_id,
        )
        .first()
    )
    return oauth.user if oauth else None


def create(
    db: Session,
    *,
    email: str,
    username: str,
    hashed_password: str | None = None,
    avatar_url: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
) -> User:
    user = User(
        email=email,
        username=username,
        hashed_password=hashed_password,
        avatar_url=avatar_url,
        first_name=first_name,
        last_name=last_name,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def update(
    db: Session,
    user: User,
    *,
    username: str | None = None,
    avatar_url: str | None = None,
    first_name: str | None = None,
    last_name: str | None = None,
) -> User:
    if username is not None:
        user.username = username
    if avatar_url is not None:
        user.avatar_url = avatar_url
    if first_name is not None:
        user.first_name = first_name
    if last_name is not None:
        user.last_name = last_name
    db.commit()
    db.refresh(user)
    return user


def create_oauth_account(
    db: Session,
    *,
    user_id: UUID,
    provider: str,
    provider_user_id: str,
) -> OAuthAccount:
    account = OAuthAccount(
        user_id=user_id,
        provider=provider,
        provider_user_id=provider_user_id,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account
