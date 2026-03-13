from sqlalchemy.orm import Session

from app.modules.users.model import User
from app.modules.users.repository import get_by_email


def get_user_for_auth(db: Session, email: str) -> User | None:
    return get_by_email(db, email)
