import logging
from typing import cast

from app.config import settings
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

REFRESH_PREFIX = "refresh_jti:"
USER_INDEX_PREFIX = "user_refresh_jtis:"


def _ttl_seconds() -> int:
    return settings.refresh_token_expire_days * 24 * 60 * 60


def _decode(value: object) -> str:
    if isinstance(value, bytes):
        return value.decode("utf-8", errors="replace")
    return str(value)


def store_refresh_jti(user_id: str, jti: str) -> None:
    try:
        redis = get_redis()
        ttl = _ttl_seconds()
        pipe = redis.pipeline()
        pipe.setex(f"{REFRESH_PREFIX}{jti}", ttl, user_id)
        pipe.sadd(f"{USER_INDEX_PREFIX}{user_id}", jti)
        pipe.expire(f"{USER_INDEX_PREFIX}{user_id}", ttl)
        pipe.execute()
    except Exception as exc:
        logger.error("Failed to store refresh jti: %s", exc)
        raise


def is_refresh_jti_valid(jti: str, expected_user_id: str) -> bool:
    # Fail closed: an unreachable registry means no tokens are valid.
    try:
        stored = get_redis().get(f"{REFRESH_PREFIX}{jti}")
    except Exception as exc:
        logger.error("Failed to read refresh jti: %s", exc)
        return False
    if stored is None:
        return False
    return _decode(stored) == expected_user_id


def revoke_refresh_jti(jti: str) -> None:
    try:
        redis = get_redis()
        owner = redis.get(f"{REFRESH_PREFIX}{jti}")
        pipe = redis.pipeline()
        pipe.delete(f"{REFRESH_PREFIX}{jti}")
        if owner is not None:
            pipe.srem(f"{USER_INDEX_PREFIX}{_decode(owner)}", jti)
        pipe.execute()
    except Exception as exc:
        logger.error("Failed to revoke refresh jti: %s", exc)


def revoke_all_user_refresh_tokens(user_id: str) -> int | None:
    """Revoke every refresh token issued to a user.

    Returns the number of tokens revoked (0 if none existed), or None if
    the operation could not be completed (e.g. Redis unreachable) -- the
    caller MUST treat None as "revocation not guaranteed", not as
    "nothing to revoke". This matters most for password-reset, which
    relies on this call to actually invalidate any session an attacker
    may hold; silently reporting success on a Redis hiccup would leave
    those sessions valid with no indication anything went wrong.
    """
    try:
        redis = get_redis()
        index_key = f"{USER_INDEX_PREFIX}{user_id}"
        # redis-py stubs type smembers as Awaitable|set across sync/async.
        jtis = cast(set[object], redis.smembers(index_key))
        if not jtis:
            return 0
        pipe = redis.pipeline()
        for raw in jtis:
            pipe.delete(f"{REFRESH_PREFIX}{_decode(raw)}")
        pipe.delete(index_key)
        pipe.execute()
        return len(jtis)
    except Exception as exc:
        logger.error("Failed to bulk-revoke refresh tokens for %s: %s", user_id, exc)
        return None
