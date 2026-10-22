from collections.abc import Callable
from datetime import UTC, datetime

# Time is injected, so the tests can move it (idle timeouts, lock-outs, one-time codes) without sleeping.
Clock = Callable[[], datetime]


def utc_now() -> datetime:
    return datetime.now(UTC)
