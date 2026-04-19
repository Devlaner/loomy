from datetime import datetime, timedelta, timezone

import pytest
from jose import jwt

from app.config import settings
from app.core.jwt import (
    create_access_token,
    create_refresh_token,
    decode_access_token,
    decode_refresh_token,
)


def test_access_token_roundtrip() -> None:
    token = create_access_token("user-123")
    assert decode_access_token(token) == "user-123"


def test_refresh_token_roundtrip() -> None:
    token, jti = create_refresh_token("user-123")
    result = decode_refresh_token(token)
    assert result == ("user-123", jti)


def test_refresh_jti_is_unique_per_call() -> None:
    _, jti_a = create_refresh_token("user-123")
    _, jti_b = create_refresh_token("user-123")
    assert jti_a != jti_b


def test_decode_access_token_rejects_refresh_token() -> None:
    refresh, _ = create_refresh_token("user-123")
    assert decode_access_token(refresh) is None


def test_decode_refresh_token_rejects_access_token() -> None:
    access = create_access_token("user-123")
    assert decode_refresh_token(access) is None


def test_decode_rejects_malformed_token() -> None:
    assert decode_access_token("not.a.jwt") is None
    assert decode_refresh_token("not.a.jwt") is None


def test_decode_rejects_wrong_signature() -> None:
    bogus = jwt.encode(
        {
            "sub": "user-123",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
            "typ": "access",
        },
        "a-different-key-entirely",
        algorithm=settings.algorithm,
    )
    assert decode_access_token(bogus) is None


def test_decode_rejects_expired_access_token() -> None:
    expired = jwt.encode(
        {
            "sub": "user-123",
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
            "typ": "access",
        },
        settings.secret_key,
        algorithm=settings.algorithm,
    )
    assert decode_access_token(expired) is None


def test_decode_rejects_expired_refresh_token() -> None:
    expired = jwt.encode(
        {
            "sub": "user-123",
            "exp": datetime.now(timezone.utc) - timedelta(minutes=1),
            "typ": "refresh",
            "jti": "some-jti",
        },
        settings.secret_key,
        algorithm=settings.algorithm,
    )
    assert decode_refresh_token(expired) is None


def test_decode_access_token_accepts_legacy_token_without_typ() -> None:
    # Pre-Phase-3.2 tokens had no `typ` claim; must stay accepted so
    # existing sessions don't log everyone out on the upgrade.
    legacy = jwt.encode(
        {
            "sub": "user-123",
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
        },
        settings.secret_key,
        algorithm=settings.algorithm,
    )
    assert decode_access_token(legacy) == "user-123"


def test_decode_access_token_missing_sub() -> None:
    token = jwt.encode(
        {
            "exp": datetime.now(timezone.utc) + timedelta(minutes=5),
            "typ": "access",
        },
        settings.secret_key,
        algorithm=settings.algorithm,
    )
    assert decode_access_token(token) is None


@pytest.mark.parametrize("bad_input", ["", "   ", "a", "a.b", "x" * 2000])
def test_decode_access_token_handles_garbage(bad_input: str) -> None:
    assert decode_access_token(bad_input) is None
