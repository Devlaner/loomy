import asyncio
import json
from typing import Any

from fastapi import WebSocket
from redis.asyncio import Redis

from app.config import settings

BOARD_CHANNEL_PREFIX = "board:"
ACTIVE_CONNECTIONS: dict[str, list[WebSocket]] = {}
_listeners: dict[str, asyncio.Task[Any]] = {}


async def get_redis_async() -> Redis:
    return Redis.from_url(settings.redis_url, decode_responses=True)


async def subscribe_board(websocket: WebSocket, board_id: str) -> None:
    if board_id not in ACTIVE_CONNECTIONS:
        ACTIVE_CONNECTIONS[board_id] = []
        _listeners[board_id] = asyncio.create_task(redis_listener(board_id))
    ACTIVE_CONNECTIONS[board_id].append(websocket)


def unsubscribe_board(websocket: WebSocket, board_id: str) -> None:
    if board_id in ACTIVE_CONNECTIONS:
        ACTIVE_CONNECTIONS[board_id] = [
            ws for ws in ACTIVE_CONNECTIONS[board_id] if ws != websocket
        ]
        if not ACTIVE_CONNECTIONS[board_id]:
            del ACTIVE_CONNECTIONS[board_id]
            if board_id in _listeners:
                _listeners[board_id].cancel()
                del _listeners[board_id]


async def broadcast_to_board(board_id: str, event: str, payload: dict[str, Any]) -> None:
    redis = await get_redis_async()
    channel = f"{BOARD_CHANNEL_PREFIX}{board_id}"
    await redis.publish(channel, json.dumps({"event": event, "data": payload}))
    await redis.aclose()


async def redis_listener(board_id: str) -> None:
    """Subscribe to Redis and forward messages to WebSocket clients."""
    redis = await get_redis_async()
    pubsub = redis.pubsub()
    channel = f"{BOARD_CHANNEL_PREFIX}{board_id}"
    await pubsub.subscribe(channel)

    try:
        async for message in pubsub.listen():
            if message["type"] == "message" and message["channel"] == channel:
                data = message["data"]
                for ws in ACTIVE_CONNECTIONS.get(board_id, [])[:]:
                    try:
                        await ws.send_text(data)
                    except Exception:
                        pass
    except asyncio.CancelledError:
        pass
    finally:
        await pubsub.unsubscribe(channel)
        await pubsub.close()
        await redis.aclose()
