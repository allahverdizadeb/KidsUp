"""The admin panel's API: its own application, container and database account (SEC-B-07).

Everything under /api/admin except signing in needs a session (default deny, see `app/panel/security.py`).
Run it as one worker: the sign-in limiter and the refresh of the public files live in the process.
"""

import asyncio
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager, suppress
from datetime import timedelta
from functools import partial

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import Settings
from app.config import settings as default_settings
from app.db import SessionLocal, engine
from app.middleware import (
    BodySizeLimitMiddleware,
    SecurityHeadersMiddleware,
    internal_error_handler,
    validation_error_handler,
)
from app.panel import errors
from app.panel.clock import Clock, utc_now
from app.panel.content_values import check_registry
from app.panel.routers import applications, audit, auth, content, courses, dashboard, staff
from app.panel.security import BACKGROUND_HEADER, CSRF_HEADER
from app.panel.services.public_site import refresh_all
from app.panel.services.secret_box import SecretBox
from app.panel.services.sessions import SessionTimes
from app.panel.services.snapshots import PublicFiles
from app.privileges import require_panel_privileges
from app.rate_limit import RateLimiter

MEDIA_PATH = "/api/admin/media"  # the one place that takes a body of picture size
logger = logging.getLogger(__name__)

EXPORTS_PER_MINUTE = 5  # an export is a copy of the families' details: rare, and each one is audited

# One place maps the panel's errors to a status and a stable body (coding standards, section 6).
ERROR_RESPONSES: dict[type[errors.PanelError], tuple[int, str, str]] = {
    errors.InvalidCredentialsError: (
        401,
        "invalid_credentials",
        "The e-mail, the password or the code is wrong.",
    ),
    errors.WrongPasswordError: (403, "wrong_password", "The current password is wrong."),
    errors.WeakPasswordError: (422, "weak_password", "The new password does not meet the rules."),
    errors.BusyError: (503, "busy", "The server is busy; try again in a moment."),
    errors.ApplicationNotFoundError: (404, "application_not_found", "No such application."),
    errors.NoteNotFoundError: (404, "note_not_found", "No such note."),
    errors.CourseNotFoundError: (404, "course_not_found", "No such course."),
    errors.NotEnoughSeatsError: (409, "not_enough_seats", "The course has too few free places."),
    errors.ApprovalLockedError: (403, "approval_locked", "Only an admin takes an approval back."),
    errors.TooManyNotesError: (409, "too_many_notes", "The application has as many notes as it may."),
    errors.CapacityBelowApprovedError: (
        409,
        "capacity_below_approved",
        "The course has more approved children than that.",
    ),
    errors.CourseHasApplicationsError: (409, "course_has_applications", "The course has applications."),
    errors.InvalidCourseError: (422, "invalid_course", "The course would make no sense that way."),
    errors.ConfirmationRequiredError: (422, "confirmation_required", "Confirm the deletion."),
    errors.UnknownContentKeyError: (422, "unknown_content_key", "No such place on the site."),
    errors.InvalidContentError: (422, "invalid_content", "The value does not fit that place."),
    errors.InvalidImageError: (422, "invalid_image", "The file is not an image the site accepts."),
    errors.MediaNotFoundError: (404, "media_not_found", "No such picture."),
    errors.MediaInUseError: (409, "media_in_use", "The picture is still used by the page."),
    errors.TooManyRowsError: (413, "too_many_rows", "Too many rows for one download."),
    errors.PublicFileError: (503, "public_file_failed", "The file could not be written; try again."),
}


def error_handler(status_code: int, code: str, detail: str) -> Callable[[Request, Exception], JSONResponse]:
    def handle(_: Request, error: Exception) -> JSONResponse:
        extra = error.extra if isinstance(error, errors.PanelError) else {}
        return JSONResponse({"detail": detail, "code": code, **extra}, status_code=status_code)

    return handle


async def keep_public_files_fresh(
    refresh: Callable[[], None], seconds: float, sleep: Callable[[float], Awaitable[None]] = asyncio.sleep
) -> None:
    """Write the public files again and again, so a change made outside the panel reaches the landing page."""
    while True:
        await sleep(seconds)
        try:
            await asyncio.to_thread(refresh)
        except Exception:
            logger.exception("the public files could not be refreshed")


def create_panel_app(
    config: Settings = default_settings,
    clock: Clock = utc_now,
    session_factory: Callable[[], Session] = SessionLocal,
) -> FastAPI:
    if config.panel_secret_key is None:
        raise RuntimeError("KIDSUP_PANEL_SECRET_KEY is required to start the admin panel.")
    config.require_web_settings_in_production(panel=True)
    check_registry()  # a mistake in the list of places on the landing page stops the panel here
    files = PublicFiles(config.panel_content_dir)
    refresh = partial(refresh_all, session_factory, files)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if config.is_production:
            # Refuse to serve as a superuser, or with rights other than the panel's own (SEC-B-07).
            require_panel_privileges(engine)
        await asyncio.to_thread(refresh)  # the landing page gets today's courses and content from the start
        refresher = asyncio.create_task(keep_public_files_fresh(refresh, config.panel_refresh_seconds))
        try:
            yield
        finally:
            refresher.cancel()
            with suppress(asyncio.CancelledError):
                await refresher

    app = FastAPI(
        title="KidsUp admin API",
        lifespan=lifespan,
        docs_url=None if config.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if config.is_production else "/openapi.json",
        redirect_slashes=False,
    )
    app.state.clock = clock
    app.state.box = SecretBox(config.panel_secret_key)
    app.state.session_times = SessionTimes(
        idle=timedelta(minutes=config.panel_session_idle_minutes),
        lifetime=timedelta(hours=config.panel_session_max_hours),
    )
    app.state.rate_limiter = RateLimiter(config.panel_rate_limit_per_minute)
    app.state.login_limiter = RateLimiter(config.panel_login_rate_limit_per_minute)
    app.state.export_limiter = RateLimiter(EXPORTS_PER_MINUTE)
    app.state.allowed_origins = frozenset(config.panel_allowed_origins)
    app.state.public_files = files

    # Last added = outermost: host check, then headers (every error carries them), then limits, then CORS.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", CSRF_HEADER, BACKGROUND_HEADER],
    )
    app.add_middleware(
        BodySizeLimitMiddleware,
        max_bytes=config.panel_max_body_bytes,
        larger={MEDIA_PATH: config.panel_max_image_bytes},
    )
    app.add_middleware(SecurityHeadersMiddleware, hsts=config.is_production)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=config.allowed_hosts)

    for error_type, (status_code, code, detail) in ERROR_RESPONSES.items():
        app.add_exception_handler(error_type, error_handler(status_code, code, detail))
    app.add_exception_handler(Exception, internal_error_handler(hsts=config.is_production))
    app.add_exception_handler(RequestValidationError, validation_error_handler())
    app.include_router(auth.router)
    app.include_router(applications.router)
    app.include_router(courses.router)
    app.include_router(dashboard.router)
    app.include_router(content.router)
    app.include_router(audit.router)
    app.include_router(staff.router)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app
