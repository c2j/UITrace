"""Custom exceptions and exception handlers for the application."""

from typing import Any

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError
from sqlalchemy.exc import SQLAlchemyError, IntegrityError
import structlog

logger = structlog.get_logger()


class UITraceException(Exception):
    """Base exception for UITrace application."""

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        details: dict | None = None,
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(self.message)


class AuthenticationError(UITraceException):
    """Authentication related errors."""

    def __init__(self, message: str = "Authentication failed", details: dict | None = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            details=details,
        )


class AuthorizationError(UITraceException):
    """Authorization related errors."""

    def __init__(self, message: str = "Access denied", details: dict | None = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            details=details,
        )


class NotFoundError(UITraceException):
    """Resource not found errors."""

    def __init__(self, message: str = "Resource not found", details: dict | None = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_404_NOT_FOUND,
            details=details,
        )


class ValidationError(UITraceException):
    """Validation errors."""

    def __init__(self, message: str = "Validation failed", details: dict | None = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            details=details,
        )


class ConflictError(UITraceException):
    """Conflict errors."""

    def __init__(self, message: str = "Resource conflict", details: dict | None = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            details=details,
        )


class RateLimitError(UITraceException):
    """Rate limit exceeded errors."""

    def __init__(self, message: str = "Rate limit exceeded", details: dict | None = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            details=details,
        )


class ExternalServiceError(UITraceException):
    """External service errors."""

    def __init__(
        self,
        message: str = "External service error",
        service_name: str | None = None,
        details: dict | None = None,
    ):
        if service_name:
            message = f"{service_name}: {message}"
        super().__init__(
            message=message,
            status_code=status.HTTP_502_BAD_GATEWAY,
            details=details,
        )


class DatabaseError(UITraceException):
    """Database related errors."""

    def __init__(self, message: str = "Database error", details: dict | None = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details=details,
        )


class ConfigurationError(UITraceException):
    """Configuration errors."""

    def __init__(self, message: str = "Configuration error", details: dict | None = None):
        super().__init__(
            message=message,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            details=details,
        )


async def uitrace_exception_handler(request: Request, exc: UITraceException) -> JSONResponse:
    """Handle UITrace custom exceptions."""
    logger.error(
        "UITrace exception",
        message=exc.message,
        status_code=exc.status_code,
        details=exc.details,
        path=request.url.path,
        method=request.method,
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "type": exc.__class__.__name__,
                "message": exc.message,
                "details": exc.details,
            }
        },
    )


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    """Handle HTTP exceptions."""
    logger.warning(
        "HTTP exception",
        status_code=exc.status_code,
        detail=exc.detail,
        path=request.url.path,
        method=request.method,
    )

    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "type": "HTTPException",
                "message": exc.detail,
                "details": {},
            }
        },
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError | ValidationError
) -> JSONResponse:
    """Handle validation exceptions."""
    errors = []

    if isinstance(exc, RequestValidationError):
        for error in exc.errors():
            errors.append({
                "field": ".".join(str(x) for x in error["loc"]),
                "message": error["msg"],
                "type": error["type"],
            })
    else:
        errors = [{"message": str(exc)}]

    logger.warning(
        "Validation error",
        errors=errors,
        path=request.url.path,
        method=request.method,
    )

    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error": {
                "type": "ValidationError",
                "message": "Validation failed",
                "details": {"errors": errors},
            }
        },
    )


async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    """Handle SQLAlchemy exceptions."""
    logger.error(
        "Database error",
        error=str(exc),
        type=type(exc).__name__,
        path=request.url.path,
        method=request.method,
    )

    # Handle specific database errors
    if isinstance(exc, IntegrityError):
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "error": {
                    "type": "IntegrityError",
                    "message": "Database integrity constraint violated",
                    "details": {},
                }
            },
        )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "type": "DatabaseError",
                "message": "Internal database error",
                "details": {},
            }
        },
    )


async def general_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Handle general unhandled exceptions."""
    logger.error(
        "Unhandled exception",
        error=str(exc),
        type=type(exc).__name__,
        path=request.url.path,
        method=request.method,
        exc_info=True,
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "type": "InternalServerError",
                "message": "Internal server error",
                "details": {},
            }
        },
    )


def setup_exception_handlers(app: FastAPI) -> None:
    """Setup exception handlers for the FastAPI application."""
    # Custom exceptions
    app.add_exception_handler(UITraceException, uitrace_exception_handler)

    # HTTP exceptions
    app.add_exception_handler(HTTPException, http_exception_handler)

    # Validation exceptions
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(ValidationError, validation_exception_handler)

    # Database exceptions
    app.add_exception_handler(SQLAlchemyError, sqlalchemy_exception_handler)

    # General exception handler (should be last)
    app.add_exception_handler(Exception, general_exception_handler)