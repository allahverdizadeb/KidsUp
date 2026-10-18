from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

BODY_METHODS = {"POST", "PUT", "PATCH"}
# The interactive docs load scripts from a CDN, so the strict CSP skips them (they are off in production).
DOCS_PATHS = ("/docs", "/redoc", "/openapi.json")

Next = Callable[[Request], Awaitable[Response]]


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds defensive headers to every response, including errors."""

    def __init__(self, app: ASGIApp, hsts: bool) -> None:
        super().__init__(app)
        self.hsts = hsts

    async def dispatch(self, request: Request, call_next: Next) -> Response:
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "no-referrer"
        response.headers["Cache-Control"] = "no-store"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        if not request.url.path.startswith(DOCS_PATHS):
            response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        if self.hsts:
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        return response


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Rejects oversized or length-less request bodies before they are read."""

    def __init__(self, app: ASGIApp, max_bytes: int) -> None:
        super().__init__(app)
        self.max_bytes = max_bytes

    async def dispatch(self, request: Request, call_next: Next) -> Response:
        if request.method in BODY_METHODS:
            length = request.headers.get("content-length")
            if length is None:
                return JSONResponse({"detail": "Content-Length required."}, status_code=411)
            if not length.isdigit() or int(length) > self.max_bytes:
                return JSONResponse({"detail": "Request body too large."}, status_code=413)
        return await call_next(request)
