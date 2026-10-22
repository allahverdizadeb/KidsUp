"""Passwords of the admin panel: Argon2id, and a few rules about what is accepted (SEC-B-03)."""

import secrets
import threading
from collections.abc import Iterator
from contextlib import contextmanager

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.panel.errors import BusyError, WeakPasswordError

MIN_LENGTH = 12
MAX_LENGTH = 128  # a very long password is a way to make the server spend its time hashing
# Argon2id with the library's current recommended cost (RFC 9106, the low-memory profile).
_hasher = PasswordHasher()
# One check takes 64 MiB, so a flood of sign-ins from many addresses must wait its turn, or be refused,
# instead of using up the container's memory. Staff are few: three at a time is plenty.
MAX_CONCURRENT_CHECKS = 3
WAIT_SECONDS = 2.0
_slots = threading.BoundedSemaphore(MAX_CONCURRENT_CHECKS)
# Checked against when the account does not exist, so that a wrong e-mail takes as long as a wrong password.
DUMMY_HASH = _hasher.hash(secrets.token_urlsafe(16))
# Passwords of the length required that are still among the first anyone tries.
OBVIOUS = frozenset(
    {
        "password1234",
        "password12345",
        "123456789012",
        "1234567890123",
        "qwertyuiopas",
        "qwertyuiop12",
        "administrator",
        "adminadmin123",
        "letmein12345",
        "iloveyou1234",
        "welcome12345",
        "kidsup123456",
    }
)


@contextmanager
def _one_of_the_slots() -> Iterator[None]:
    """Hold one of the few places for a password check; BusyError if none frees up soon."""
    if not _slots.acquire(timeout=WAIT_SECONDS):
        raise BusyError
    try:
        yield
    finally:
        _slots.release()


def hash_password(password: str) -> str:
    with _one_of_the_slots():
        return _hasher.hash(password)


def verify_password(stored_hash: str, password: str) -> bool:
    with _one_of_the_slots():
        try:
            return _hasher.verify(stored_hash, password)
        except (VerificationError, InvalidHashError):
            return False


def needs_rehash(stored_hash: str) -> bool:
    return _hasher.check_needs_rehash(stored_hash)


def require_acceptable_password(password: str, email: str) -> None:
    """Refuse a password that is short, long, obvious, one repeated character, or the account's own e-mail."""
    if len(password) < MIN_LENGTH:
        raise WeakPasswordError(rule="min_length", minimum=MIN_LENGTH)
    if len(password) > MAX_LENGTH:
        raise WeakPasswordError(rule="max_length", maximum=MAX_LENGTH)
    lowered = password.lower()
    if lowered in OBVIOUS or len(set(password)) < 4 or lowered in (email, email.split("@")[0]):
        raise WeakPasswordError(rule="too_obvious")
