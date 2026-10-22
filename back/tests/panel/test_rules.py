"""Small rules the admin panel relies on everywhere: who holds what, what is recorded, what is accepted."""

import threading
import time
from concurrent.futures import ThreadPoolExecutor

import pytest
from argon2 import PasswordHasher

from app.models import AdminRole
from app.panel.errors import BusyError, WeakPasswordError
from app.panel.permissions import ROLE_PERMISSIONS, Permission, has_permission
from app.panel.services import passwords
from app.panel.services.network import shorten_network


def held_by(role: str) -> set[Permission]:
    return {permission for permission in Permission if has_permission(role, permission)}


# --- roles (SEC-B-04)


@pytest.mark.parametrize("role", ["owner", "", "ADMIN", "admin ", "root", "superuser"])
def test_a_role_the_code_does_not_know_holds_nothing(role):
    assert held_by(role) == set()


def test_every_role_holds_what_it_is_listed_for_and_nothing_else():
    assert set(ROLE_PERMISSIONS) == set(AdminRole)
    for role, listed in ROLE_PERMISSIONS.items():
        assert held_by(role.value) == listed


def test_the_roles_widen_step_by_step_and_only_an_admin_exports_deletes_and_runs_the_site():
    viewer, coordinator, admin = (
        held_by(role.value) for role in (AdminRole.VIEWER, AdminRole.COORDINATOR, AdminRole.ADMIN)
    )

    assert viewer == {Permission.DASHBOARD_READ, Permission.APPLICATIONS_READ, Permission.COURSES_READ}
    assert coordinator - viewer == {Permission.APPLICATIONS_UPDATE}
    assert viewer < coordinator < admin
    assert admin - coordinator == {
        Permission.APPLICATIONS_EXPORT,
        Permission.APPLICATIONS_DELETE,
        Permission.COURSES_WRITE,
        Permission.CONTENT_MANAGE,
        Permission.AUDIT_READ,
    }


def test_whoever_may_read_the_dashboard_may_read_applications_because_it_shows_the_latest_ones():
    # The dashboard lists the newest applications, with names and phone numbers, under its own permission.
    # While every role that holds it also reads applications, that is no wider than the list itself.
    for role in AdminRole:
        if has_permission(role.value, Permission.DASHBOARD_READ):
            assert has_permission(role.value, Permission.APPLICATIONS_READ), role


def test_leaving_approved_needs_the_right_to_erase_and_only_an_admin_has_it():
    # The retention job deletes what is not approved, so taking an approval back is an erasure in effect.
    holders = {role for role in AdminRole if has_permission(role.value, Permission.APPLICATIONS_DELETE)}

    assert holders == {AdminRole.ADMIN}


# --- the network that is recorded (SEC-B-10)


@pytest.mark.parametrize(
    ("address", "network"),
    [
        ("203.0.113.77", "203.0.113.0/24"),
        ("198.51.100.255", "198.51.100.0/24"),
        ("2001:db8:1234:5678:9abc::1", "2001:db8:1234::/48"),
    ],
)
def test_only_the_network_of_an_address_is_kept_never_the_address(address, network):
    assert shorten_network(address) == network


@pytest.mark.parametrize("address", [None, "", "not an address", "999.1.1.1", "203.0.113"])
def test_nothing_is_kept_for_something_that_is_not_an_address(address):
    assert shorten_network(address) is None


# --- passwords (SEC-B-03)


def test_the_longest_password_is_accepted_and_one_more_character_is_not():
    longest = "ab12" * (passwords.MAX_LENGTH // 4)
    assert len(longest) == passwords.MAX_LENGTH

    passwords.require_acceptable_password(longest, "someone@example.test")
    with pytest.raises(WeakPasswordError) as refused:
        passwords.require_acceptable_password(longest + "x", "someone@example.test")
    assert refused.value.extra == {"rule": "max_length", "maximum": passwords.MAX_LENGTH}


def test_a_hash_made_with_weaker_settings_than_today_s_is_recognised_for_replacing():
    weak = PasswordHasher(time_cost=1, memory_cost=8, parallelism=1).hash("a long password for the test")

    assert passwords.needs_rehash(weak)
    assert not passwords.needs_rehash(passwords.hash_password("a long password for the test"))
    assert passwords.verify_password(weak, "a long password for the test")  # it still verifies until replaced


def test_something_that_is_not_a_hash_verifies_nothing():
    assert passwords.verify_password("not a hash", "whatever") is False


# --- the few places for password checks (one check takes 64 MiB)


def test_a_password_check_gives_its_place_back_even_when_there_is_nothing_to_check():
    for _ in range(passwords.MAX_CONCURRENT_CHECKS * 4):
        # A place that leaked would block the fourth call until it gave up with BusyError.
        assert passwords.verify_password("not a hash", "whatever") is False


def test_when_no_place_frees_up_a_check_gives_up_instead_of_waiting_for_ever(monkeypatch):
    monkeypatch.setattr(passwords, "_slots", threading.BoundedSemaphore(0))
    monkeypatch.setattr(passwords, "WAIT_SECONDS", 0.01)

    with pytest.raises(BusyError):
        passwords.hash_password("a long password for the test")
    with pytest.raises(BusyError):
        passwords.verify_password("not a hash", "whatever")


def test_no_more_checks_run_at_once_than_there_are_places(monkeypatch):
    lock = threading.Lock()
    running = {"now": 0, "most": 0}

    class SlowHasher:
        def verify(self, _stored_hash: str, _password: str) -> bool:
            with lock:
                running["now"] += 1
                running["most"] = max(running["most"], running["now"])
            time.sleep(0.05)
            with lock:
                running["now"] -= 1
            return True

    monkeypatch.setattr(passwords, "_hasher", SlowHasher())

    with ThreadPoolExecutor(max_workers=10) as pool:
        answers = list(pool.map(lambda _: passwords.verify_password("a hash", "a password"), range(10)))

    assert answers == [True] * 10
    assert 1 < running["most"] <= passwords.MAX_CONCURRENT_CHECKS
