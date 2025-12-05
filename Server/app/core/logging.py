"""
Logging configuration using structlog
"""

import structlog
import logging
import sys
from pathlib import Path

from app.core.config import settings


def setup_logging():
    """Setup structured logging"""

    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, settings.LOG_LEVEL.upper()),
    )

    # Configure structlog
    structlog.configure(
        processors=[
            structlog.stdlib.filter_by_level,
            structlog.stdlib.add_logger_name,
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.UnicodeDecoder(),
            structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    # Create logs directory if needed
    if settings.logging.file_path:
        log_dir = Path(settings.logging.file_path).parent
        log_dir.mkdir(parents=True, exist_ok=True)


def get_logger(name: str = None):
    """Get structured logger"""
    if name:
        return structlog.get_logger(name)
    return structlog.get_logger()


class LoggerMixin:
    """Mixin class to add logging capabilities"""

    @property
    def logger(self):
        """Get logger for this class"""
        return get_logger(self.__class__.__name__)