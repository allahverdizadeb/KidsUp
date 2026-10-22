"""One-time codes (RFC 6238) for the second factor of every admin account (SEC-B-03).

A code is accepted once: the time step of the last accepted code is stored with the account, and a code from
that step or an earlier one is refused, so a code that was watched over a shoulder or captured cannot be used
again within its 30 seconds. The step before and the step after the current one are accepted for clocks that
differ a little.
"""

import hmac
from datetime import datetime

import pyotp

STEP_SECONDS = 30
DRIFT_STEPS = 1
ISSUER = "KidsUp"
# What a code the account does not have is compared with, so that the answer takes the same time.
_ANY_SECRET = pyotp.random_base32()


def new_secret() -> str:
    return pyotp.random_base32()


def provisioning_uri(secret: str, email: str) -> str:
    """What an authenticator app reads from a QR code (or the secret can be typed in by hand)."""
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name=ISSUER)


def step_of(moment: datetime) -> int:
    return int(moment.timestamp()) // STEP_SECONDS


def matching_step(secret: str | None, code: str, now: datetime, last_step: int | None) -> int | None:
    """The time step the code belongs to, or None if it is wrong, expired, or from a step already used."""
    totp = pyotp.TOTP(secret or _ANY_SECRET)
    matched: int | None = None
    current = step_of(now)
    for step in range(current - DRIFT_STEPS, current + DRIFT_STEPS + 1):
        # Every step is compared, whatever the first comparison says, so the time taken tells nothing.
        is_equal = hmac.compare_digest(totp.at(step * STEP_SECONDS), code)
        if is_equal and matched is None and secret is not None and (last_step is None or step > last_step):
            matched = step
    return matched
