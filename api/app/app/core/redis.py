import json
from typing import Any, Dict, cast

from redis import Redis

from app.config import settings

_redis: Redis | None = None
_redis_bytes: Redis | None = None
BOARD_CHANNEL_PREFIX = "board:"

# Must match FRAME_TEXT in app.websocket.manager. Messages on the board
# pub/sub channel are prefixed with one byte so listeners can tell text
# frames (FRAME_TEXT) from binary Yjs frames (FRAME_BINARY) on the same
# channel. The listener in manager.py expects this format.
_FRAME_TEXT = b"T"


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = Redis.from_url(settings.redis_url, decode_responses=True)
    return _redis


def _get_redis_bytes() -> Redis:
    global _redis_bytes
    if _redis_bytes is None:
        _redis_bytes = Redis.from_url(settings.redis_url, decode_responses=False)
    return _redis_bytes


def publish(channel: str, message: str) -> int:
    result = get_redis().publish(channel, message)
    return cast(int, result)


def publish_board_event(board_id: str, event: str, data: Dict[str, Any]) -> int:
    channel = f"{BOARD_CHANNEL_PREFIX}{board_id}"
    body = json.dumps({"event": event, "data": data}).encode("utf-8")
    result = _get_redis_bytes().publish(channel, _FRAME_TEXT + body)
    return cast(int, result)


OAUTH_STATE_PREFIX = "oauth_state:"
OAUTH_STATE_TTL = 600  # 10 minutes


def set_oauth_state(state: str, invite_token: str | None = None) -> bool:
    try:
        r = get_redis()
        payload = {"invite_token": invite_token}
        r.setex(f"{OAUTH_STATE_PREFIX}{state}", OAUTH_STATE_TTL, json.dumps(payload))
        return True
    except Exception:
        return False


def validate_oauth_state(state: str) -> Dict[str, Any] | None:
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
