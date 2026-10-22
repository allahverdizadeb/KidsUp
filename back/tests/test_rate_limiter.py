import threading

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.rate_limit import WINDOW_SECONDS, RateLimiter, caller_key
from tests.conftest import make_settings
from tests.test_applications import VALID


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


def test_clients_within_the_window_are_all_kept_however_many_there_are():
    limiter = RateLimiter(5, FakeClock())

    for i in range(3000):  # more than the threshold for looking for idle ones, but none is idle
        limiter.allow(f"ip-{i}")

    assert len(limiter.hits) == 3000


def test_the_bookkeeping_is_done_under_a_lock_because_requests_run_in_several_threads():
    limiter = RateLimiter(5, FakeClock())
    held = []
    real_forget = limiter._forget_idle

    def spy(now: float) -> None:
        held.append(limiter._lock.locked())
        real_forget(now)

    limiter._forget_idle = spy  # type: ignore[method-assign]

    limiter.allow("a")

    assert held == [True]


def test_many_threads_at_once_neither_fail_nor_lose_count():
    limiter = RateLimiter(3, FakeClock())
    outcomes: list[bool] = []

    def hammer(worker: int) -> None:
        for i in range(1500):  # past the threshold for looking for idle ones, from several threads
            outcomes.append(limiter.allow(f"worker-{worker}-client-{i}"))
        outcomes.extend(limiter.allow("shared") for _ in range(20))

    threads = [threading.Thread(target=hammer, args=(worker,)) for worker in range(8)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(20)

    assert len(outcomes) == 8 * (1500 + 20)
    assert outcomes.count(True) == 8 * 1500 + 3  # the shared client got exactly its three
    assert len(limiter.hits["shared"]) == 3


@pytest.mark.parametrize(
    ("host", "key"),
    [
        ("203.0.113.7", "203.0.113.7"),
        ("2001:db8:1:2::1", "2001:db8:1:2::/64"),
        ("2001:0db8:0001:0002:ffff:ffff:ffff:ffff", "2001:db8:1:2::/64"),
        ("::ffff:203.0.113.7", "203.0.113.7"),  # an IPv4 client seen through an IPv6 socket
        ("testclient", "testclient"),
        ("unknown", "unknown"),
    ],
)
def test_an_ipv6_client_is_one_budget_for_its_whole_network(host, key):
    assert caller_key(host) == key


def test_two_addresses_of_one_ipv6_network_share_the_budget_and_another_network_has_its_own():
    app = create_app(make_settings(rate_limit_per_minute=2))
    home = TestClient(app, client=("2001:db8:1:2::1", 50000))
    same_network = TestClient(app, client=("2001:db8:1:2:abcd::9", 50000))
    other_network = TestClient(app, client=("2001:db8:1:3::1", 50000))

    statuses = [
        client.post("/api/applications", json=VALID).status_code
        for client in (home, same_network, home, same_network, other_network)
    ]

    assert statuses == [201, 201, 429, 429, 201]
