import asyncio
import json
from typing import Any

from fastapi import WebSocket
from redis.asyncio import Redis

from app.config import settings

BOARD_CHANNEL_PREFIX = "board:"

FRAME_TEXT = b"T"
FRAME_BINARY = b"B"

ACTIVE_CONNECTIONS: dict[str, list[WebSocket]] = {}
_listeners: dict[str, asyncio.Task[Any]] = {}

# Last-seen cursor identity per connection, so we can tell peers exactly
# who left when the socket closes (same key shape as a cursor.moved frame).
_CONNECTION_CURSOR_IDENTITY: dict[WebSocket, dict[str, str]] = {}


async def _get_redis_binary() -> Redis:
    # decode_responses=False so binary Yjs frames survive the round-trip.
    return Redis.from_url(settings.redis_url, decode_responses=False)


async def subscribe_board(websocket: WebSocket, board_id: str) -> None:
    if board_id not in ACTIVE_CONNECTIONS:
        ACTIVE_CONNECTIONS[board_id] = []
        _listeners[board_id] = asyncio.create_task(redis_listener(board_id))
    ACTIVE_CONNECTIONS[board_id].append(websocket)


def note_cursor_identity(websocket: WebSocket, client_id: str, user_id: str) -> None:
    """Remember the client_id/user_id a connection last broadcast a cursor as,
    so unsubscribe_board can tell peers exactly who left."""
    _CONNECTION_CURSOR_IDENTITY[websocket] = {
        "client_id": client_id,
        "user_id": user_id,
    }


async def unsubscribe_board(websocket: WebSocket, board_id: str) -> None:
    identity = _CONNECTION_CURSOR_IDENTITY.pop(websocket, None)
    if board_id in ACTIVE_CONNECTIONS:
        ACTIVE_CONNECTIONS[board_id] = [
            ws for ws in ACTIVE_CONNECTIONS[board_id] if ws != websocket
        ]
        if not ACTIVE_CONNECTIONS[board_id]:
            del ACTIVE_CONNECTIONS[board_id]
            if board_id in _listeners:
                _listeners[board_id].cancel()
                del _listeners[board_id]

    if identity is not None:
        # Best-effort: if Redis/publish fails here, the frontend's
        # timeout-based sweep still cleans up the stale cursor eventually.
        try:
            await broadcast_to_board(board_id, "peer.left", identity)
        except Exception:
            pass


async def broadcast_to_board(board_id: str, event: str, payload: dict[str, Any]) -> None:
    redis = await _get_redis_binary()
    channel = f"{BOARD_CHANNEL_PREFIX}{board_id}"
    body = json.dumps({"event": event, "data": payload}).encode("utf-8")
    await redis.publish(channel, FRAME_TEXT + body)
    await redis.aclose()


async def broadcast_binary_to_board(board_id: str, data: bytes) -> None:
    redis = await _get_redis_binary()
    channel = f"{BOARD_CHANNEL_PREFIX}{board_id}"
    await redis.publish(channel, FRAME_BINARY + data)
    await redis.aclose()


async def redis_listener(board_id: str) -> None:
    redis = await _get_redis_binary()
    pubsub = redis.pubsub()
    channel = f"{BOARD_CHANNEL_PREFIX}{board_id}".encode()
    await pubsub.subscribe(channel)

    try:
        async for message in pubsub.listen():
            if message["type"] != "message" or message["channel"] != channel:
                continue
            raw = message["data"]
            if not isinstance(raw, (bytes, bytearray)) or len(raw) < 1:
                continue
            prefix = bytes(raw[:1])
            body = bytes(raw[1:])
            if prefix == FRAME_TEXT:
                text = body.decode("utf-8", errors="replace")
                for ws in ACTIVE_CONNECTIONS.get(board_id, [])[:]:
                    try:
                        await ws.send_text(text)
                    except Exception:
                        pass
            elif prefix == FRAME_BINARY:
                for ws in ACTIVE_CONNECTIONS.get(board_id, [])[:]:
                    try:
                        await ws.send_bytes(body)
                    except Exception:
                        pass
    except asyncio.CancelledError:
        pass
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()
        await redis.aclose()
