import json
import logging
import os
import sys
import time
from contextvars import ContextVar
from typing import Any

from app.config import settings

request_id_ctx: ContextVar[str | None] = ContextVar("request_id", default=None)


class _RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get()
        return True


class _JsonFormatter(logging.Formatter):
    _RESERVED = frozenset(
        {
            "args",
            "asctime",
            "created",
            "exc_info",
            "exc_text",
            "filename",
            "funcName",
            "levelname",
            "levelno",
            "lineno",
            "message",
            "module",
            "msecs",
            "msg",
            "name",
            "pathname",
            "process",
            "processName",
            "relativeCreated",
            "request_id",
            "stack_info",
            "taskName",
            "thread",
            "threadName",
        }
    )

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "ts": time.strftime(
                "%Y-%m-%dT%H:%M:%SZ", time.gmtime(record.created)
            ),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        request_id = getattr(record, "request_id", None)
        if request_id:
            payload["request_id"] = request_id
        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)

        extras = {
            k: v for k, v in record.__dict__.items() if k not in self._RESERVED
        }
        if extras:
            payload["context"] = extras

        return json.dumps(payload, default=str)


def configure_logging() -> None:
    root = logging.getLogger()
    if getattr(root, "_loomy_configured", False):
        return

    level_name = os.environ.get("LOG_LEVEL", "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    handler.addFilter(_RequestIdFilter())
    if settings.environment == "production":
        handler.setFormatter(_JsonFormatter())
    else:
        handler.setFormatter(
            logging.Formatter(
                "%(asctime)s %(levelname)-7s %(name)s "
                "[req=%(request_id)s] %(message)s"
            )
        )

    for existing in list(root.handlers):
        root.removeHandler(existing)
    root.addHandler(handler)
    root.setLevel(level)
    root._loomy_configured = True  # type: ignore[attr-defined]

    _init_sentry_if_configured()


def _init_sentry_if_configured() -> None:
    dsn = os.environ.get("SENTRY_DSN", "").strip()
    if not dsn:
        return
    try:
        import sentry_sdk  # type: ignore[import-not-found]
    except ImportError:
        logging.getLogger(__name__).warning(
            "SENTRY_DSN is set but sentry_sdk is not installed"
        )
        return
    sentry_sdk.init(
        dsn=dsn,
        environment=settings.environment,
        traces_sample_rate=0.0,
    )
