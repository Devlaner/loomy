"""get_client_ip must never trust X-Forwarded-For from a client that
isn't a configured trusted proxy -- otherwise rate limiting is trivially
bypassed by sending a fresh header value on every request."""

from typing import Any, cast

import pytest
from fastapi import Request

from app.config import settings
from app.core.client_ip import get_client_ip


class FakeClient:
    def __init__(self, host: str) -> None:
        self.host = host


class FakeRequest:
    def __init__(self, peer: str, headers: dict[str, str] | None = None) -> None:
        self.client = FakeClient(peer)
        self.headers = headers or {}


def _req(peer: str, headers: dict[str, str] | None = None) -> Request:
    return cast(Request, FakeRequest(peer, headers))


@pytest.fixture(autouse=True)
def _reset_trusted_proxies(monkeypatch: Any) -> Any:
    monkeypatch.setattr(settings, "trusted_proxy_cidrs", "")
    yield


def test_xff_ignored_when_no_trusted_proxies_configured() -> None:
    req = _req("203.0.113.9", {"x-forwarded-for": "1.2.3.4"})
    assert get_client_ip(req) == "203.0.113.9"


def test_xff_ignored_when_peer_is_not_a_trusted_proxy(monkeypatch: Any) -> None:
    monkeypatch.setattr(settings, "trusted_proxy_cidrs", "10.0.0.0/8")
    # Direct, untrusted client spoofing the header -- must be ignored.
    req = _req("203.0.113.9", {"x-forwarded-for": "9.9.9.9"})
    assert get_client_ip(req) == "203.0.113.9"


def test_xff_honored_when_peer_is_a_trusted_proxy(monkeypatch: Any) -> None:
    monkeypatch.setattr(settings, "trusted_proxy_cidrs", "10.0.0.0/8")
    req = _req("10.0.0.5", {"x-forwarded-for": "198.51.100.7"})
    assert get_client_ip(req) == "198.51.100.7"


def test_xff_right_most_untrusted_hop_used_with_chained_proxies(
    monkeypatch: Any,
) -> None:
    monkeypatch.setattr(settings, "trusted_proxy_cidrs", "10.0.0.0/8")
    # Real client, then two trusted proxy hops appended their own IPs.
    # Walking right-to-left skips both trusted hops and lands on the
    # real client at the left.
    req = _req(
        "10.0.0.5",
        {"x-forwarded-for": "198.51.100.7, 10.0.0.1, 10.0.0.2"},
    )
    assert get_client_ip(req) == "198.51.100.7"


def test_attacker_cannot_spoof_a_fake_prefix_hop(monkeypatch: Any) -> None:
    monkeypatch.setattr(settings, "trusted_proxy_cidrs", "10.0.0.0/8")
    # An attacker connecting directly to our trusted reverse proxy sends
    # X-Forwarded-For: 6.6.6.6 (trying to impersonate a different IP).
    # A correctly configured proxy *appends* the real connecting IP
    # rather than trusting/replacing the client's value, so the header
    # we actually receive is "6.6.6.6, <attacker's real IP>". Walking
    # right-to-left must land on the attacker's real IP, not their
    # spoofed prefix.
    req = _req("10.0.0.5", {"x-forwarded-for": "6.6.6.6, 198.51.100.42"})
    assert get_client_ip(req) == "198.51.100.42"


def test_no_xff_header_falls_back_to_peer_even_when_trusted(
    monkeypatch: Any,
) -> None:
    monkeypatch.setattr(settings, "trusted_proxy_cidrs", "10.0.0.0/8")
    req = _req("10.0.0.5")
    assert get_client_ip(req) == "10.0.0.5"
