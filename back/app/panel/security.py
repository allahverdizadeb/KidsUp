"""Who is calling, and may they (SEC-B-03, SEC-B-04): the one door every protected endpoint goes through.

Default deny: an endpoint of the panel is reachable only through `require(permission)`. That checks, in this
order, the session cookie (401), for a request that changes something the `Origin` and the CSRF token (403),
and the role's permission (403). Which role holds which permission is in `app/panel/permissions.py`.
"""

import hmac
import logging
from collections.abc import Callable

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.panel.clock import Clock
from app.panel.permissions import Permission, has_permission
from app.panel.principal import Principal
from app.panel.services import sessions
from app.panel.services.network import shorten_network
from app.panel.state import get_clock, get_session_times
from app.rate_limit import RateLimiter, reject_if_over_limit

logger = logging.getLogger(__name__)

SESSION_COOKIE = "__Secure-kidsup_admin"
COOKIE_PATH = "/api/admin"  # the narrowest path that covers the panel's API (SEC-B-06)
CSRF_HEADER = "X-CSRF-Token"
# A page that refreshes itself (asks whether there is news, loads a list again because there is) sends this:
# the request does not extend the session, so a forgotten tab cannot keep itself signed in. It counts on a GET
# and on the one read that has to be a POST (the search: a name or a phone number never goes into an address).
# Anything else that is sent is somebody working, whatever the header says.
BACKGROUND_HEADER = "X-Background"
BACKGROUND_POLL = "poll"
UNSAFE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def client_network(request: Request) -> str | None:
    return shorten_network(request.client.host if request.client else None)


def enforce_login_rate_limit(request: Request) -> None:
    limiter: RateLimiter = request.app.state.login_limiter
    reject_if_over_limit(limiter, request)


def enforce_export_rate_limit(request: Request) -> None:
    limiter: RateLimiter = request.app.state.export_limiter
    reject_if_over_limit(limiter, request)


def require_trusted_origin(request: Request) -> None:
    """A request that changes something must come from one of the panel's own pages (CSRF defence)."""
    allowed: frozenset[str] = request.app.state.allowed_origins
    origin = request.headers.get("origin")
    if request.method in UNSAFE_METHODS and origin is not None and origin not in allowed:
        logger.warning("request from an origin that is not the panel's")
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden.")


def open_session(
    request: Request,
    db: Session,
    clock: Clock,
    times: sessions.SessionTimes,
    *,
    may_be_background: bool,
) -> Principal:
    token = request.cookies.get(SESSION_COOKIE)
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated.")
    is_poll = may_be_background and request.headers.get(BACKGROUND_HEADER) == BACKGROUND_POLL
    now = clock()
    found = sessions.find_open_session(db, token, now, times)
    if found is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated.")
    if request.method in UNSAFE_METHODS:
        require_trusted_origin(request)
        sent = request.headers.get(CSRF_HEADER, "")
        if not hmac.compare_digest(sent.encode(), found.csrf_token.encode()):
            logger.warning("request without the session's CSRF token")
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden.")
    # Only a request that passed every check counts as somebody working, and not one the page made by itself.
    if not is_poll:
        sessions.touch_session(db, found.session_id, now)
    admin = found.admin
    return Principal(
        admin_id=admin.id,
        email=admin.email,
        display_name=admin.display_name,
        role=admin.role,
        session_id=found.session_id,
        csrf_token=found.csrf_token,
        network=client_network(request),
    )


def authenticate(
    request: Request,
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
    times: sessions.SessionTimes = Depends(get_session_times),
) -> Principal:
    return open_session(request, db, clock, times, may_be_background=request.method == "GET")


def authenticate_read_only_post(
    request: Request,
    db: Session = Depends(get_db),
    clock: Clock = Depends(get_clock),
    times: sessions.SessionTimes = Depends(get_session_times),
) -> Principal:
    """The door of a read that has to be a POST: like a GET, it can be a background request."""
    return open_session(request, db, clock, times, may_be_background=True)


def require(permission: Permission, *, read_only_post: bool = False) -> Callable[[Principal], Principal]:
    """`read_only_post`: a POST that only reads (the search), which a page may refresh quietly."""
    door = authenticate_read_only_post if read_only_post else authenticate

    def check(principal: Principal = Depends(door)) -> Principal:
        if not has_permission(principal.role, permission):
            logger.warning("permission denied")
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Forbidden.")
        return principal

    return check
