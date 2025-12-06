"""Logging configuration and utilities."""

import logging
import logging.handlers
import sys
from pathlib import Path
from typing import Any, Dict

import structlog
from pythonjsonlogger import jsonlogger

from app.core.config import settings


def setup_logging() -> None:
    """Setup structured logging for the application."""
    # Remove default handlers
    root_logger = logging.getLogger()
    root_logger.handlers.clear()

    # Set log level
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    root_logger.setLevel(log_level)

    # Create formatters
    json_formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(name)s %(levelname)s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    console_formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    # Console handler
    if settings.LOG_FORMAT == "json":
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(json_formatter)
    else:
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(console_formatter)

    console_handler.setLevel(log_level)
    root_logger.addHandler(console_handler)

    # File handler (if log file is specified)
    if settings.LOG_FILE:
        log_path = Path(settings.LOG_FILE)
        log_path.parent.mkdir(parents=True, exist_ok=True)

        # Rotating file handler
        file_handler = logging.handlers.RotatingFileHandler(
            filename=log_path,
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5,
        )
        file_handler.setFormatter(json_formatter)
        file_handler.setLevel(log_level)
        root_logger.addHandler(file_handler)

    # Configure structlog
    processors = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
    ]

    if settings.LOG_FORMAT == "json":
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer(colors=True))

    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )


def get_logger(name: str) -> structlog.stdlib.BoundLogger:
    """Get a structured logger with the given name."""
    return structlog.get_logger(name)


class LoggerMixin:
    """Mixin class to add logging capabilities to classes."""

    @property
    def logger(self) -> structlog.stdlib.BoundLogger:
        """Get logger for this class."""
        return structlog.get_logger(self.__class__.__name__)


def log_function_call(logger: structlog.stdlib.BoundLogger):
    """Decorator to log function calls."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            logger.info(
                "Function called",
                function=func.__name__,
                module=func.__module__,
                args=args,
                kwargs=kwargs,
            )
            try:
                result = func(*args, **kwargs)
                logger.info(
                    "Function completed",
                    function=func.__name__,
                    module=func.__module__,
                )
                return result
            except Exception as e:
                logger.error(
                    "Function failed",
                    function=func.__name__,
                    module=func.__module__,
                    error=str(e),
                    exc_info=True,
                )
                raise
        return wrapper
    return decorator


async def log_async_function_call(logger: structlog.stdlib.BoundLogger):
    """Decorator to log async function calls."""
    def decorator(func):
        async def wrapper(*args, **kwargs):
            logger.info(
                "Async function called",
                function=func.__name__,
                module=func.__module__,
                args=args,
                kwargs=kwargs,
            )
            try:
                result = await func(*args, **kwargs)
                logger.info(
                    "Async function completed",
                    function=func.__name__,
                    module=func.__module__,
                )
                return result
            except Exception as e:
                logger.error(
                    "Async function failed",
                    function=func.__name__,
                    module=func.__module__,
                    error=str(e),
                    exc_info=True,
                )
                raise
        return wrapper
    return decorator


def log_request_details(
    logger: structlog.stdlib.BoundLogger,
    request_data: Dict[str, Any],
    response_data: Dict[str, Any] | None = None,
) -> None:
    """Log request and response details."""
    log_data = {
        "request": request_data,
    }

    if response_data:
        log_data["response"] = response_data

    logger.info("API request", **log_data)


def log_error_with_context(
    logger: structlog.stdlib.BoundLogger,
    error: Exception,
    context: Dict[str, Any] | None = None,
) -> None:
    """Log error with additional context."""
    log_data = {
        "error_type": type(error).__name__,
        "error_message": str(error),
    }

    if context:
        log_data.update(context)

    logger.error("Error occurred", **log_data, exc_info=True)


# Audit logging
def log_audit_event(
    logger: structlog.stdlib.BoundLogger,
    user_id: str | None,
    action: str,
    entity_type: str,
    entity_id: str | None = None,
    details: Dict[str, Any] | None = None,
) -> None:
    """Log audit events."""
    log_data = {
        "event_type": "audit",
        "user_id": user_id,
        "action": action,
        "entity_type": entity_type,
        "entity_id": entity_id,
    }

    if details:
        log_data["details"] = details

    logger.info("Audit event", **log_data)


# Security logging
def log_security_event(
    logger: structlog.stdlib.BoundLogger,
    event_type: str,
    user_id: str | None = None,
    ip_address: str | None = None,
    details: Dict[str, Any] | None = None,
) -> None:
    """Log security events."""
    log_data = {
        "event_type": "security",
        "security_event": event_type,
        "user_id": user_id,
        "ip_address": ip_address,
    }

    if details:
        log_data["details"] = details

    # Always log security events at INFO level or higher
    if event_type in ["login_failed", "access_denied", "suspicious_activity"]:
        logger.warning("Security event", **log_data)
    else:
        logger.info("Security event", **log_data)


# Performance logging
def log_performance_metric(
    logger: structlog.stdlib.BoundLogger,
    metric_name: str,
    value: float,
    unit: str = "ms",
    tags: Dict[str, str] | None = None,
) -> None:
    """Log performance metrics."""
    log_data = {
        "event_type": "metric",
        "metric_name": metric_name,
        "metric_value": value,
        "metric_unit": unit,
    }

    if tags:
        log_data["tags"] = tags

    logger.info("Performance metric", **log_data)