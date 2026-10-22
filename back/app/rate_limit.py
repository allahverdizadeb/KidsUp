import ipaddress
import logging
import threading
import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import HTTPException, Request, status

logger = logging.getLogger(__name__)

WINDOW_SECONDS = 60
SWEEP_ABOVE = 1024  # clients tracked before idle ones are looked for


def caller_key(host: str) -> str:
    """Whom a limit is kept for. An IPv6 client is one /64: a home or a phone is given a whole /64 and can use
    any address in it, so counting full addresses would give an attacker as many budgets as it likes."""
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        return host  # not an address (a test client's name, "unknown"): its own key
    if isinstance(address, ipaddress.IPv6Address):
        if address.ipv4_mapped is not None:
            return str(address.ipv4_mapped)
        return str(ipaddress.ip_network(f"{address}/64", strict=False))
    return str(address)


class RateLimiter:
    """Sliding-window limiter, kept in process memory.

    Per instance only: with several API replicas the effective limit is multiplied, so a shared
    limiter (Redis or the edge proxy) must back this up at scale. Requests are handled in several threads, so
    the bookkeeping is done under a lock.
    """

    def __init__(self, limit_per_minute: int, clock: Callable[[], float] = time.monotonic) -> None:
        self.limit = limit_per_minute
        self.clock = clock
        self.hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = threading.Lock()
        self._swept_at = clock()

    def allow(self, key: str) -> bool:
        with self._lock:
            now = self.clock()
            recent = self.hits[key]
            while recent and now - recent[0] >= WINDOW_SECONDS:
                recent.popleft()
            if len(recent) >= self.limit:
                return False
            recent.append(now)
            self._forget_idle(now)
            return True

    def _forget_idle(self, now: float) -> None:
        # Bound memory: drop clients whose every hit has left the window, looking at most once per window.
        if len(self.hits) < SWEEP_ABOVE or now - self._swept_at < WINDOW_SECONDS:
            return
        self._swept_at = now
        for key in [k for k, q in self.hits.items() if not q or now - q[-1] >= WINDOW_SECONDS]:
            del self.hits[key]


def reject_if_over_limit(limiter: RateLimiter, request: Request) -> None:
    """429 when the caller exceeds the limiter's per-minute limit."""
    caller = caller_key(request.client.host) if request.client else "unknown"
    if not limiter.allow(caller):
        # No address in the log: an IP is personal data, and the event is what an operator needs (SEC-B-10).
        logger.warning("rate limit exceeded")
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many requests.",
            headers={"Retry-After": str(WINDOW_SECONDS)},
        )


def enforce_rate_limit(request: Request) -> None:
    """FastAPI dependency: 429 when the caller exceeds the per-minute limit."""
    reject_if_over_limit(request.app.state.rate_limiter, request)
