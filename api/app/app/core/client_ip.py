"""Trusted-proxy-aware client IP resolution, shared by every rate limiter.

X-Forwarded-For is attacker-controlled on any request that reaches this
process directly (no proxy in front, or the proxy isn't configured to
strip/overwrite it). Trusting it unconditionally lets a client reset its
own rate-limit bucket on every request just by sending a fresh header
value. We only honor it when the immediate TCP peer is a configured
trusted proxy, and even then only take the right-most hop that isn't
itself one of those proxies.
"""

import ipaddress

from fastapi import Request

from app.config import settings

_IPNetwork = ipaddress.IPv4Network | ipaddress.IPv6Network


def _trusted_networks() -> tuple[_IPNetwork, ...]:
    # Not cached: settings.trusted_proxy_cidrs can change between tests,
    # and parsing a short comma list is cheap enough to redo per call.
    nets = []
    for raw in settings.trusted_proxy_cidrs.split(","):
        raw = raw.strip()
        if not raw:
            continue
        try:
            nets.append(ipaddress.ip_network(raw, strict=False))
        except ValueError:
            continue
    return tuple(nets)


def _is_trusted(ip: str) -> bool:
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return False
    return any(addr in net for net in _trusted_networks())


def get_client_ip(request: Request) -> str:
    peer = request.client.host if request.client else "unknown"

    if not _trusted_networks() or not _is_trusted(peer):
        # No trusted proxies configured, or this request didn't come
        # from one: never honor a client-supplied X-Forwarded-For.
        return peer

    xff = request.headers.get("x-forwarded-for")
    if not xff:
        return peer

    hops = [h.strip() for h in xff.split(",") if h.strip()]
    # Walk right-to-left (closest to us first) and return the first hop
    # that isn't itself one of our trusted proxies -- that's the real
    # client, since each trusted proxy only ever appends its own address.
    for hop in reversed(hops):
        if not _is_trusted(hop):
            return hop
    return peer
