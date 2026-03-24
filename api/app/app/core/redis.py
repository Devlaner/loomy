import json
from typing import Any, Dict, cast

from redis import Redis

from app.config import settings

_redis: Redis | None = None
BOARD_CHANNEL_PREFIX = "board:"


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


def publish(channel: str, message: str) -> int:
    result = get_redis().publish(channel, message)
    return cast(int, result)


def publish_board_event(board_id: str, event: str, data: Dict[str, Any]) -> int:
    """Publish a board event for WebSocket broadcasting."""
    channel = f"{BOARD_CHANNEL_PREFIX}{board_id}"
    return publish(channel, json.dumps({"event": event, "data": data}))


OAUTH_STATE_PREFIX = "oauth_state:"
OAUTH_STATE_TTL = 600  # 10 minutes


def set_oauth_state(state: str, invite_token: str | None = None) -> bool:
    """Store OAuth state for CSRF validation."""
    try:
        r = get_redis()
        payload = {"invite_token": invite_token}
        r.setex(f"{OAUTH_STATE_PREFIX}{state}", OAUTH_STATE_TTL, json.dumps(payload))
        return True
    except Exception:
        return False


def validate_oauth_state(state: str) -> Dict[str, Any] | None:
    """Validate and consume OAuth state, returning stored payload."""
    try:
        r = get_redis()
        key = f"{OAUTH_STATE_PREFIX}{state}"
        raw = r.get(key)
        if raw:
            r.delete(key)
            if not isinstance(raw, (str, bytes, bytearray)):
                return {}
            try:
                data = json.loads(raw)
                if isinstance(data, dict):
                    return data
            except Exception:
                return {}
            return {}
        return None
    except Exception:
        return None
