from app.rate_limit import WINDOW_SECONDS, RateLimiter


class FakeClock:
    def __init__(self) -> None:
        self.now = 1000.0

    def __call__(self) -> float:
        return self.now


def test_allows_up_to_the_limit_then_blocks():
    limiter = RateLimiter(2, FakeClock())
    assert [limiter.allow("a") for _ in range(3)] == [True, True, False]


def test_limits_are_per_caller():
    limiter = RateLimiter(1, FakeClock())
    assert limiter.allow("a") is True
    assert limiter.allow("b") is True
    assert limiter.allow("a") is False


def test_window_slides():
    clock = FakeClock()
    limiter = RateLimiter(1, clock)
    assert limiter.allow("a") is True
    clock.now += WINDOW_SECONDS - 1
    assert limiter.allow("a") is False
    clock.now += 1
    assert limiter.allow("a") is True


def test_idle_callers_are_forgotten_so_memory_stays_bounded():
    clock = FakeClock()
    limiter = RateLimiter(5, clock)
    for i in range(1100):
        limiter.allow(f"ip-{i}")
    clock.now += WINDOW_SECONDS
    limiter.allow("fresh")
    assert len(limiter.hits) < 10
