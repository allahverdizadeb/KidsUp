import time
from collections import defaultdict, deque
from collections.abc import Callable

from fastapi import HTTPException, Request, status

WINDOW_SECONDS = 60


class RateLimiter:
    """Sliding-window limiter, kept in process memory.

    Per instance only: with several API replicas the effective limit is multiplied, so a shared
    limiter (Redis or the edge proxy) must back this up at scale.
    """

    def __init__(self, limit_per_minute: int, clock: Callable[[], float] = time.monotonic) -> None:
        self.limit = limit_per_minute
        self.clock = clock
        self.hits: dict[str, deque[float]] = defaultdict(deque)

    def allow(self, key: str) -> bool:
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
        # Bound memory: drop clients whose every hit has left the window.
        if len(self.hits) < 1024:
            return
        for key in [k for k, q in self.hits.items() if not q or now - q[-1] >= WINDOW_SECONDS]:
            del self.hits[key]


def enforce_rate_limit(request: Request) -> None:
    """FastAPI dependency: 429 when the caller exceeds the per-minute limit."""
    limiter: RateLimiter = request.app.state.rate_limiter
    caller = request.client.host if request.client else "unknown"
    if not limiter.allow(caller):
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Too many requests.",
            headers={"Retry-After": str(WINDOW_SECONDS)},
        )
