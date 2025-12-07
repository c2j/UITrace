"""
UITrace Server - Python FastAPI backend
High-performance UI automation testing platform server
"""

import asyncio
import logging
import os
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

import structlog
from prometheus_client import generate_latest, CONTENT_TYPE_LATEST, REGISTRY

from src.api import auth, scripts, data, results, users, projects
from src.core.config import settings
from src.core.database import init_db, close_db
from src.core.logging import setup_logging
from src.services.network_resilience import init_network_resilience_service, cleanup_network_resilience_service
from src.services.browser_automation import init_browser_automation_service, cleanup_browser_automation_service
from src.services.cdp_service import init_cdp_service, cleanup_cdp_service
from src.services.execution_resilience import init_execution_resilience_service, cleanup_execution_resilience_service
from src.services.performance_monitoring import init_performance_monitoring, cleanup_performance_monitoring

# Setup structured logging
setup_logging()
logger = structlog.get_logger()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting UITrace Server")
    await init_db()
    logger.info("Database initialized")

    # Initialize network resilience services
    logger.info("Initializing network resilience services")
    await init_network_resilience_service()
    await init_browser_automation_service()
    await init_cdp_service()
    await init_execution_resilience_service()
    logger.info("Network resilience services initialized")

    # Initialize performance monitoring
    logger.info("Initializing performance monitoring")
    init_performance_monitoring()
    logger.info("Performance monitoring initialized")

    yield

    # Shutdown
    logger.info("Shutting down UITrace Server")

    # Cleanup resilience services
    logger.info("Cleaning up network resilience services")
    await cleanup_execution_resilience_service()
    await cleanup_cdp_service()
    await cleanup_browser_automation_service()
    await cleanup_network_resilience_service()
    logger.info("Network resilience services cleaned up")

    # Cleanup performance monitoring
    logger.info("Cleaning up performance monitoring")
    cleanup_performance_monitoring()
    logger.info("Performance monitoring cleaned up")

    await close_db()
    logger.info("Database connections closed")

# Create FastAPI application
app = FastAPI(
    title="UITrace API",
    description="High-performance UI automation testing platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Configure middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(GZipMiddleware, minimum_size=1000)

# Include API routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(projects.router, prefix="/api/v1/projects", tags=["Projects"])
app.include_router(scripts.router, prefix="/api/v1/scripts", tags=["Scripts"])
app.include_router(data.router, prefix="/api/v1/data", tags=["Data Files"])
app.include_router(results.router, prefix="/api/v1/results", tags=["Results"])

# Static files
if Path("static").exists():
    app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def root():
    """Root endpoint - serve API documentation or simple health check"""
    if Path("static/index.html").exists():
        return HTMLResponse(content=Path("static/index.html").read_text())
    return HTMLResponse(content="""
    <!DOCTYPE html>
    <html>
    <head>
        <title>UITrace API</title>
        <meta charset="utf-8">
    </head>
    <body>
        <h1>UITrace API</h1>
        <p>High-performance UI automation testing platform</p>
        <p><a href="/docs">API Documentation</a></p>
        <p><a href="/redoc">ReDoc Documentation</a></p>
    </body>
    </html>
    """)

@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {"status": "healthy", "service": "uitrace-server"}

@app.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint"""
    if settings.ENVIRONMENT == "production":
        return Response(generate_latest(REGISTRY), media_type=CONTENT_TYPE_LATEST)
    return {"error": "Metrics not available in development"}

# Exception handlers
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(
        "Unhandled exception",
        exc_info=exc,
        extra={
            "method": request.method,
            "url": str(request.url),
            "client": request.client.host if request.client else "unknown"
        }
    )
    return {"error": "Internal server error"}, 500

if __name__ == "__main__":
    import uvicorn

    log_config = {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {
            "default": {
                "()": structlog.stdlib.ProcessorFormatter,
                "processor": structlog.dev.ConsoleRenderer(colors=False),
            },
        },
        "handlers": {
            "default": {
                "formatter": "default",
                "class": "logging.StreamHandler",
                "stream": "ext://sys.stdout",
            },
        },
        "root": {
            "level": "INFO",
            "handlers": ["default"],
        },
        "loggers": {
            "uvicorn": {
                "level": "INFO",
                "handlers": ["default"],
                "propagate": False,
            },
            "sqlalchemy.engine": {
                "level": "WARNING",
                "handlers": ["default"],
                "propagate": False,
            },
        },
    }

    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        log_config=log_config,
        reload=settings.DEBUG,
        access_log=settings.DEBUG,
        loop="asyncio"  # Use asyncio for better performance
    )