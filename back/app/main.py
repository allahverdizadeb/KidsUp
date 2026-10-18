from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware

from app.config import Settings
from app.config import settings as default_settings
from app.middleware import BodySizeLimitMiddleware, SecurityHeadersMiddleware
from app.rate_limit import RateLimiter
from app.routers import applications


def create_app(config: Settings = default_settings) -> FastAPI:
    app = FastAPI(
        title="KidsUp API",
        # The interactive docs and schema are an information leak in production.
        docs_url=None if config.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if config.is_production else "/openapi.json",
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
