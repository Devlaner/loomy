from datetime import datetime, timedelta, timezone
from typing import Any

from jose import JWTError, jwt

from app.config import settings


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode = {"sub": subject, "exp": expire}
    encoded = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return str(encoded)


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        sub: Any = payload.get("sub")
        if isinstance(sub, str):
            return sub
        return None
    except JWTError:
        return None
