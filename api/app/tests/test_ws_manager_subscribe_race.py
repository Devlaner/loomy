"""subscribe_board must not return until the Redis pubsub subscription for
the board is actually active, and must not hang forever if Redis itself
is unreachable at connect time.

These use a fake Redis/pubsub (no real Redis needed) so the timing
assertions are deterministic instead of relying on a real network race.
"""

import asyncio
import time
from typing import Any, cast

import pytest
from fastapi import WebSocket

from app.websocket import manager


class FakePubSub:
    def __init__(self, subscribe_delay: float = 0.0, fail: bool = False) -> None:
        self._subscribe_delay = subscribe_delay
        self._fail = fail
        self.subscribed_at: float | None = None

    async def subscribe(self, _channel: bytes) -> None:
        if self._subscribe_delay:
            await asyncio.sleep(self._subscribe_delay)
        if self._fail:
            raise ConnectionError("redis unreachable")
        self.subscribed_at = time.monotonic()

    async def listen(self) -> Any:
        # Never yields -- this test only cares about subscribe() timing,
        # not message delivery.
        while True:
            await asyncio.sleep(3600)
            yield {}

    async def unsubscribe(self, _channel: bytes) -> None:
        pass

    async def close(self) -> None:
        pass


class FakeRedis:
    def __init__(self, pubsub: FakePubSub) -> None:
        self._pubsub = pubsub

    def pubsub(self) -> FakePubSub:
        return self._pubsub

    async def aclose(self) -> None:
        pass

    async def publish(self, _channel: str, _data: bytes) -> None:
        pass


@pytest.fixture(autouse=True)
def _reset_manager_state() -> Any:
    manager.ACTIVE_CONNECTIONS.clear()
    manager._listeners.clear()
    manager._listener_ready.clear()
    yield
    for task in manager._listeners.values():
        task.cancel()
    manager.ACTIVE_CONNECTIONS.clear()
    manager._listeners.clear()
    manager._listener_ready.clear()


def test_subscribe_board_waits_for_redis_subscription(monkeypatch: Any) -> None:
    fake_pubsub = FakePubSub(subscribe_delay=0.05)
    fake_redis = FakeRedis(fake_pubsub)

    async def fake_get_redis_binary() -> FakeRedis:
        return fake_redis

    monkeypatch.setattr(manager, "_get_redis_binary", fake_get_redis_binary)

    async def run() -> None:
        ws = cast(WebSocket, object())
        await manager.subscribe_board(ws, "board-a")
        returned_at = time.monotonic()
        assert fake_pubsub.subscribed_at is not None
        assert returned_at >= fake_pubsub.subscribed_at
        assert ws in manager.ACTIVE_CONNECTIONS["board-a"]

    asyncio.run(run())


def test_subscribe_board_raises_instead_of_hanging_when_redis_fails(
    monkeypatch: Any,
) -> None:
    fake_pubsub = FakePubSub(fail=True)
    fake_redis = FakeRedis(fake_pubsub)

    async def fake_get_redis_binary() -> FakeRedis:
        return fake_redis

    monkeypatch.setattr(manager, "_get_redis_binary", fake_get_redis_binary)

    async def run() -> None:
        ws = cast(WebSocket, object())
        with pytest.raises(ConnectionError):
            await asyncio.wait_for(
                manager.subscribe_board(ws, "board-b"), timeout=2
            )
        # No leftover state for a board whose subscribe never succeeded.
        assert "board-b" not in manager.ACTIVE_CONNECTIONS
        assert "board-b" not in manager._listeners
        assert "board-b" not in manager._listener_ready

    asyncio.run(run())
