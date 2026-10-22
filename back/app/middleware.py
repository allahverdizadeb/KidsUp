from collections.abc import Awaitable, Callable, Mapping

from fastapi import Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

BODY_METHODS = {"POST", "PUT", "PATCH"}
MAX_LOCATION_PART = 64  # a field name; a name the caller made up (an unknown key) is cut short
# The interactive docs load scripts from a CDN, so the strict CSP skips them (they are off in production).
DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")

Next = Callable[[Request], Awaitable[Response]]


def add_security_headers(response: Response, path: str, *, hsts: bool) -> None:
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Cache-Control"] = "no-store"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    if not path.startswith(DOCS_PATHS):
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    if hsts:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds defensive headers to every response, including errors."""

    def __init__(self, app: ASGIApp, hsts: bool) -> None:
        super().__init__(app)
        self.hsts = hsts

    async def dispatch(self, request: Request, call_next: Next) -> Response:
        response = await call_next(request)
        add_security_headers(response, request.url.path, hsts=self.hsts)
        return response


def internal_error_handler(*, hsts: bool) -> Callable[[Request, Exception], JSONResponse]:
    """Answers an unexpected failure with nothing to learn from (SEC-B-12) and with the security headers.

    Starlette builds this answer outside the middleware above, so the headers cannot be added there
    (SEC-B-11).
    """

    def handle(request: Request, _error: Exception) -> JSONResponse:
        response = JSONResponse({"detail": "Internal server error."}, status_code=500)
        add_security_headers(response, request.url.path, hsts=hsts)
        return response

    return handle


def validation_error_handler() -> Callable[[Request, Exception], JSONResponse]:
    """Answers a request that fails validation with where and what kind of fault, never with what was sent.

    FastAPI's own answer repeats every refused value (`input`: a password, a parent's or a child's name) and
    the limits (`ctx`). Only the place and the kind of each fault go back (SEC-B-01, SEC-B-12): enough for a
    page to choose its message, and nothing that could end up in a log or a proxy's copy of the answer.
    """

    def handle(_: Request, error: Exception) -> JSONResponse:
        faults = error.errors() if isinstance(error, RequestValidationError) else []
        detail = [
            {"loc": [str(part)[:MAX_LOCATION_PART] for part in fault["loc"]], "type": fault["type"]}
            for fault in faults
        ]
        return JSONResponse({"detail": detail}, status_code=422)

    return handle


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Rejects oversized or length-less request bodies before they are read.

    `larger` names paths that may take a bigger body than the rest (the admin panel's picture upload).
    """

    def __init__(self, app: ASGIApp, max_bytes: int, larger: Mapping[str, int] | None = None) -> None:
        super().__init__(app)
        self.max_bytes = max_bytes
        self.larger = larger or {}

    async def dispatch(self, request: Request, call_next: Next) -> Response:
        if request.method in BODY_METHODS:
            length = request.headers.get("content-length")
            if length is None:
                return JSONResponse({"detail": "Content-Length required."}, status_code=411)
            allowed = self.larger.get(request.url.path, self.max_bytes)
            if not length.isdigit() or int(length) > allowed:
                return JSONResponse({"detail": "Request body too large."}, status_code=413)
        return await call_next(request)
