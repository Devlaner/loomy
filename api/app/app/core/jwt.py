from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from jose import JWTError, jwt

from app.config import settings


def create_access_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(
        minutes=settings.access_token_expire_minutes
    )
    payload = {"sub": subject, "exp": expire, "typ": "access"}
    return str(jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm))


def decode_access_token(token: str) -> str | None:
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
    except JWTError:
        return None
    # Legacy tokens issued before `typ` existed have no claim; they can
    # only be access tokens, so we accept them.
    typ: Any = payload.get("typ")
    if typ is not None and typ != "access":
        return None
    sub: Any = payload.get("sub")
    return sub if isinstance(sub, str) else None


def create_refresh_token(subject: str) -> tuple[str, str]:
    jti = str(uuid4())
    expire = datetime.now(timezone.utc) + timedelta(
        days=settings.refresh_token_expire_days
    )
    payload = {"sub": subject, "exp": expire, "typ": "refresh", "jti": jti}
    encoded = jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)
    return str(encoded), jti


def decode_refresh_token(token: str) -> tuple[str, str] | None:
    try:
        payload = jwt.decode(
            token, settings.secret_key, algorithms=[settings.algorithm]
        )
    except JWTError:
        return None
    if payload.get("typ") != "refresh":
        return None
    sub: Any = payload.get("sub")
    jti: Any = payload.get("jti")
    if isinstance(sub, str) and isinstance(jti, str):
        return sub, jti
    return None
