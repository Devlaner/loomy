"""revoke_all_user_refresh_tokens must distinguish "nothing to revoke"
(0) from "couldn't complete the revocation" (None) -- callers like
password-reset confirm rely on this to know whether it's safe to report
success."""

from typing import Any


from app.core import token_store


class FakePipeline:
    def __init__(self, redis: "FakeRedis") -> None:
        self._redis = redis
        self._ops: list[tuple[str, tuple[Any, ...]]] = []

    def delete(self, key: str) -> "FakePipeline":
        self._ops.append(("delete", (key,)))
        return self

    def execute(self) -> list[Any]:
        for op, args in self._ops:
            getattr(self._redis, f"_do_{op}")(*args)
        return [None] * len(self._ops)


class FakeRedis:
    def __init__(
        self, members: set[bytes] | None = None, fail: bool = False
    ) -> None:
        self._members = members or set()
        self._fail = fail
        self._store: dict[str, bytes] = {}

    def smembers(self, _key: str) -> set[bytes]:
        if self._fail:
            raise ConnectionError("redis unreachable")
        return self._members

    def pipeline(self) -> FakePipeline:
        return FakePipeline(self)

    def _do_delete(self, key: str) -> None:
        self._store.pop(key, None)


def test_returns_zero_when_user_has_no_tokens(monkeypatch: Any) -> None:
    fake = FakeRedis(members=set())
    monkeypatch.setattr(token_store, "get_redis", lambda: fake)
    assert token_store.revoke_all_user_refresh_tokens("user-1") == 0


def test_returns_count_when_tokens_revoked(monkeypatch: Any) -> None:
    fake = FakeRedis(members={b"jti-a", b"jti-b", b"jti-c"})
    monkeypatch.setattr(token_store, "get_redis", lambda: fake)
    assert token_store.revoke_all_user_refresh_tokens("user-1") == 3


def test_returns_none_not_zero_when_redis_fails(monkeypatch: Any) -> None:
    fake = FakeRedis(fail=True)
    monkeypatch.setattr(token_store, "get_redis", lambda: fake)
    result = token_store.revoke_all_user_refresh_tokens("user-1")
    # The critical assertion: a Redis failure must be distinguishable
    # from "there was nothing to revoke". Returning 0 here would let a
    # caller (e.g. password-reset confirm) believe revocation succeeded
    # when it didn't run at all.
    assert result is None
    assert result != 0
