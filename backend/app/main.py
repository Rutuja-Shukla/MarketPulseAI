"""MarketPulse AI API entrypoint."""
from __future__ import annotations

import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.middleware.base import BaseHTTPMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.core.logging import configure_logging, get_logger, request_id_ctx
from app.db.session import SessionLocal, engine, init_db
from app.services.demo_seed import seed_demo_workspace

configure_logging("DEBUG" if settings.environment == "development" else "INFO")
logger = get_logger("marketpulse.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    if settings.demo_mode and settings.seed_demo_on_startup:
        db = SessionLocal()
        try:
            seeded = seed_demo_workspace(db)
            if seeded:
                logger.info("demo_seed_completed")
        except Exception:  # noqa: BLE001 - demo seeding must not block startup
            logger.exception("demo_seed_failed")
            db.rollback()
        finally:
            db.close()
    logger.info(
        "api_started",
        extra={
            "event": "startup",
            "stage": "live" if settings.live_research_available else "demo-only",
        },
    )
    yield


app = FastAPI(
    title="MarketPulse AI",
    description=(
        "Market intelligence, product analysis and strategic opportunity discovery. "
        "All findings are derived from stored evidence records."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid.uuid4())
        token = request_id_ctx.set(request_id)
        try:
            response = await call_next(request)
        finally:
            request_id_ctx.reset(token)
        response.headers["x-request-id"] = request_id
        response.headers["x-content-type-options"] = "nosniff"
        response.headers["referrer-policy"] = "strict-origin-when-cross-origin"
        return response


app.add_middleware(RequestContextMiddleware)


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "request_id": request_id_ctx.get()},
        headers=getattr(exc, "headers", None),
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": "Some fields need attention.",
            "errors": [
                {
                    "field": ".".join(str(part) for part in error.get("loc", [])[1:]),
                    "message": error.get("msg", ""),
                }
                for error in exc.errors()
            ],
            "request_id": request_id_ctx.get(),
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("unhandled_exception", extra={"event": request.url.path})
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Something went wrong on our side. The error has been logged.",
            "request_id": request_id_ctx.get(),
        },
    )


@app.get("/health", tags=["health"])
def health() -> dict:
    database = "ok"
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:  # noqa: BLE001
        database = "unavailable"
    return {
        "status": "ok" if database == "ok" else "degraded",
        "database": database,
        "demo_mode": settings.demo_mode,
        "live_research_available": settings.live_research_available,
        "job_runner": settings.job_runner,
        "environment": settings.environment,
    }


app.include_router(api_router, prefix=settings.api_prefix)
