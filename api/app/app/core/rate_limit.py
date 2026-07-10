import logging
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.client_ip import get_client_ip
from app.core.redis import get_redis

logger = logging.getLogger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple IP-based rate limiting via Redis."""

    def __init__(
        self,
        app: Any,
        *,
        requests_per_minute: int = 60,
        key_prefix: str = "rl",
    ) -> None:
        super().__init__(app)
        self.requests_per_minute = requests_per_minute
        self.key_prefix = key_prefix

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        try:
            redis = get_redis()
            client_ip = get_client_ip(request)
            key = f"{self.key_prefix}:{client_ip}"

            pipe = redis.pipeline()
            pipe.incr(key)
            pipe.expire(key, 60)
            count, _ = pipe.execute()

            if count > self.requests_per_minute:
                return Response(
                    content="Too Many Requests",
                    status_code=429,
                )
        except Exception as exc:
            logger.warning("Rate limit skipped (Redis unavailable): %s", exc)
        return await call_next(request)
