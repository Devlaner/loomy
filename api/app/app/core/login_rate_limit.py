import logging

from fastapi import HTTPException, Request, status

from app.core.client_ip import get_client_ip
from app.core.redis import get_redis

logger = logging.getLogger(__name__)

LOGIN_MAX_ATTEMPTS = 10
LOGIN_WINDOW_SECONDS = 15 * 60
LOGIN_RL_PREFIX = "login_rl"


def enforce_login_rate_limit(request: Request) -> None:
    ip = get_client_ip(request)
    key = f"{LOGIN_RL_PREFIX}:{ip}"
    try:
        redis = get_redis()
        pipe = redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, LOGIN_WINDOW_SECONDS)
        count, _ = pipe.execute()
    except Exception as exc:
        logger.warning("Login rate limit skipped (Redis unavailable): %s", exc)
        return

    if isinstance(count, int) and count > LOGIN_MAX_ATTEMPTS:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=(
                f"Too many login attempts. Try again in "
                f"{LOGIN_WINDOW_SECONDS // 60} minutes."
            ),
        )
