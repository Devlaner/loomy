from collections.abc import Awaitable, Callable
from uuid import uuid4

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging import request_id_ctx

HEADER = "X-Request-ID"


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        incoming = request.headers.get(HEADER)
        request_id = incoming if incoming else uuid4().hex
        token = request_id_ctx.set(request_id)
        try:
            response = await call_next(request)
        finally:
            request_id_ctx.reset(token)
        response.headers[HEADER] = request_id
        return response
