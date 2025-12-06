"""Main FastAPI application entry point."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
import structlog
import time

from app.api.auth import router as auth_router
from app.api.projects import router as projects_router
from app.api.scripts import router as scripts_router
from app.api.executions import router as executions_router
from app.api.users import router as users_router
from app.core.config import settings
from app.core.database import init_db, check_db_connection, close_db
from app.utils.exceptions import setup_exception_handlers
from app.utils.logging import setup_logging

logger = structlog.get_logger()

# Setup logging
setup_logging()

# Store the application instance
app_state = {"startup_time": time.time()}


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan events."""
    # Startup
    logger.info("Starting UITrace Server", version=settings.APP_VERSION)

    # Initialize database
    try:
        await init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error("Failed to initialize database", error=str(e))
        raise

    # Check database connection
    if not await check_db_connection():
        logger.error("Database connection failed")
        raise Exception("Database connection failed")

    logger.info("UITrace Server started successfully")

    yield

    # Shutdown
    logger.info("Shutting down UITrace Server")
    await close_db()
    logger.info("UITrace Server stopped")


# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description=settings.APP_DESCRIPTION,
    version=settings.APP_VERSION,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Setup exception handlers
setup_exception_handlers(app)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
    allow_credentials=settings.ALLOW_CREDENTIALS,
    allow_methods=settings.ALLOW_METHODS,
    allow_headers=settings.ALLOW_HEADERS,
)

# Trusted host middleware
if not settings.DEBUG:
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["localhost", "127.0.0.1", "*.uitrace.com"]
    )


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all requests."""
    start_time = time.time()

    # Get client IP
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    else:
        client_ip = request.client.host if request.client else "unknown"

    # Log request
    logger.info(
        "Request started",
        method=request.method,
        url=str(request.url),
        client_ip=client_ip,
        user_agent=request.headers.get("user-agent", "unknown"),
    )

    # Process request
    response = await call_next(request)

    # Calculate duration
    duration = time.time() - start_time

    # Log response
    logger.info(
        "Request completed",
        method=request.method,
        url=str(request.url),
        status_code=response.status_code,
        duration_ms=duration * 1000,
    )

    # Add timing header
    response.headers["X-Response-Time"] = f"{duration:.3f}s"

    return response


# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    """Add security headers to responses."""
    response = await call_next(request)

    # Security headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

    return response


# Include routers
app.include_router(
    auth_router,
    prefix=f"{settings.API_V1_STR}/auth",
    tags=["authentication"]
)

app.include_router(
    users_router,
    prefix=f"{settings.API_V1_STR}/users",
    tags=["users"]
)

app.include_router(
    projects_router,
    prefix=f"{settings.API_V1_STR}/projects",
    tags=["projects"]
)

app.include_router(
    scripts_router,
    prefix=f"{settings.API_V1_STR}/scripts",
    tags=["scripts"]
)

app.include_router(
    executions_router,
    prefix=f"{settings.API_V1_STR}/executions",
    tags=["executions"]
)


# Health check endpoints
@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    db_healthy = await check_db_connection()

    uptime = time.time() - app_state["startup_time"]

    return {
        "status": "healthy" if db_healthy else "unhealthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "uptime_seconds": uptime,
        "database": "healthy" if db_healthy else "unhealthy",
    }


@app.get("/health/ready")
async def readiness_check() -> dict:
    """Readiness check endpoint."""
    db_healthy = await check_db_connection()

    if not db_healthy:
        return JSONResponse(
            status_code=503,
            content={
                "status": "not ready",
                "service": settings.APP_NAME,
                "database": "unhealthy",
            }
        )

    return {
        "status": "ready",
        "service": settings.APP_NAME,
        "database": "healthy",
    }


@app.get("/health/live")
async def liveness_check() -> dict:
    """Liveness check endpoint."""
    return {
        "status": "alive",
        "service": settings.APP_NAME,
        "uptime_seconds": time.time() - app_state["startup_time"],
    }


# Root endpoint
@app.get("/")
async def root() -> dict:
    """Root endpoint."""
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "version": settings.APP_VERSION,
        "docs_url": "/docs" if settings.DEBUG else None,
        "api_v1": settings.API_V1_STR,
    }


# API info endpoint
@app.get(f"{settings.API_V1_STR}/info")
async def api_info() -> dict:
    """API information endpoint."""
    return {
        "name": settings.APP_NAME,
        "description": settings.APP_DESCRIPTION,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "api_version": settings.API_V1_STR,
        "features": {
            "authentication": True,
            "projects": True,
            "scripts": True,
            "executions": True,
            "teams": True,
            "webhooks": True,
        },
    }
