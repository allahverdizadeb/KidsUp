from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import Settings
from app.config import settings as default_settings
from app.db import engine
from app.middleware import BodySizeLimitMiddleware, SecurityHeadersMiddleware
from app.privileges import require_least_privilege
from app.rate_limit import RateLimiter
from app.routers import applications


def create_app(config: Settings = default_settings) -> FastAPI:
    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if config.is_production:
            # Refuse to serve as a superuser, or as an account that can read stored details back (SEC-B-07).
            require_least_privilege(engine)
        yield

    app = FastAPI(
        title="KidsUp API",
        lifespan=lifespan,
        # The interactive docs and schema are an information leak in production.
        docs_url=None if config.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if config.is_production else "/openapi.json",
        # POST /api/applications/ is a plain 404, not a redirect to the Host nginx forwards ("back").
        redirect_slashes=False,
    )
    app.state.rate_limiter = RateLimiter(config.rate_limit_per_minute)

    # Last added = outermost: host check, then headers (every error carries them), then limits, then CORS.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type"],
    )
    app.add_middleware(BodySizeLimitMiddleware, max_bytes=config.max_body_bytes)
    app.add_middleware(SecurityHeadersMiddleware, hsts=config.is_production)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=config.allowed_hosts)

    app.include_router(applications.router)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
