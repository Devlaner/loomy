import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.router import api_router
from app.config import settings
from app.core.logging import configure_logging
from app.core.redis import get_redis
from app.db.session import SessionLocal
from app.middleware.request_id import RequestIDMiddleware

configure_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("Loomy API starting", extra={"environment": settings.environment})
    try:
        from app.modules.boards.template_seed import seed_builtin_templates

        with SessionLocal() as session:
            seeded = seed_builtin_templates(session)
        logger.info("Seeded %d built-in templates", seeded)
    except Exception as exc:
        # Seeding must never block startup — missing tables on a fresh
        # deploy are fine; the log is enough signal.
        logger.warning("Template seeding skipped: %s", exc)
    yield
    logger.info("Loomy API shutting down")


app = FastAPI(
    title="Loomy API",
    description="Open-source collaborative whiteboard API",
    version="0.0.1",
    lifespan=lifespan,
)
origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
if settings.frontend_url:
    base = settings.frontend_url.rstrip("/")
    if base not in origins:
        origins.append(base)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(RequestIDMiddleware)

app.include_router(api_router, prefix="")


def _check_db() -> tuple[bool, str | None]:
    try:
        with SessionLocal() as session:
            session.execute(text("SELECT 1"))
        return True, None
    except Exception:
        # Full trace goes to the log. The public /health response stays
        # generic so we don't leak DSNs, internal hostnames, or the
        # exact DB error to anyone hitting the endpoint.
        logger.warning("Database health check failed", exc_info=True)
        return False, "unavailable"


def _check_redis() -> tuple[bool, str | None]:
    try:
        get_redis().ping()
        return True, None
    except Exception:
        logger.warning("Redis health check failed", exc_info=True)
        return False, "unavailable"


@app.get("/health")
def health() -> JSONResponse:
    db_ok, db_err = _check_db()
    redis_ok, redis_err = _check_redis()
    status_ok = db_ok and redis_ok
    payload: dict[str, object] = {
        "status": "ok" if status_ok else "degraded",
        "environment": settings.environment,
        "checks": {
            "database": {"ok": db_ok, "error": db_err},
            "redis": {"ok": redis_ok, "error": redis_err},
        },
    }
    return JSONResponse(status_code=200 if status_ok else 503, content=payload)
