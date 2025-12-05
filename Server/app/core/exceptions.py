"""
Custom exceptions for UITrace Server
"""

from typing import Optional, Dict, Any
from uuid import uuid4


class UITraceException(Exception):
    """Base exception for UITrace"""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        details: Optional[Dict[str, Any]] = None,
        request_id: Optional[str] = None
    ):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        self.request_id = request_id or str(uuid4())
        super().__init__(self.message)


class AuthenticationError(UITraceException):
    """Authentication related errors"""

    def __init__(self, message: str = "Authentication failed", **kwargs):
        super().__init__(message, status_code=401, **kwargs)


class AuthorizationError(UITraceException):
    """Authorization related errors"""

    def __init__(self, message: str = "Access denied", **kwargs):
        super().__init__(message, status_code=403, **kwargs)


class ValidationError(UITraceException):
    """Validation errors"""

    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None, **kwargs):
        super().__init__(message, status_code=400, details=details, **kwargs)


class NotFoundError(UITraceException):
    """Resource not found errors"""

    def __init__(self, message: str = "Resource not found", **kwargs):
        super().__init__(message, status_code=404, **kwargs)


class ConflictError(UITraceException):
    """Resource conflict errors"""

    def __init__(self, message: str = "Resource conflict", **kwargs):
        super().__init__(message, status_code=409, **kwargs)


class DatabaseError(UITraceException):
    """Database related errors"""

    def __init__(self, message: str = "Database error", **kwargs):
        super().__init__(message, status_code=500, **kwargs)


class WebDriverError(UITraceException):
    """WebDriver related errors"""

    def __init__(self, message: str = "WebDriver error", **kwargs):
        super().__init__(message, status_code=500, **kwargs)


class FileProcessingError(UITraceException):
    """File processing errors"""

    def __init__(self, message: str = "File processing error", **kwargs):
        super().__init__(message, status_code=500, **kwargs)


class RateLimitError(UITraceException):
    """Rate limiting errors"""

    def __init__(self, message: str = "Rate limit exceeded", **kwargs):
        super().__init__(message, status_code=429, **kwargs)


class ServiceUnavailableError(UITraceException):
    """Service unavailable errors"""

    def __init__(self, message: str = "Service temporarily unavailable", **kwargs):
        super().__init__(message, status_code=503, **kwargs)


class BusinessLogicError(UITraceException):
    """Business logic related errors"""

    def __init__(self, message: str, status_code: int = 400, **kwargs):
        super().__init__(message, status_code=status_code, **kwargs)


# Helper functions for raising specific exceptions
def raise_not_found(message: str, **kwargs):
    """Raise not found exception"""
    raise NotFoundError(message, **kwargs)


def raise_validation_error(message: str, details: Optional[Dict[str, Any]] = None, **kwargs):
    """Raise validation exception"""
    raise ValidationError(message, details, **kwargs)


def raise_auth_error(message: str = "Authentication required", **kwargs):
    """Raise authentication exception"""
    raise AuthenticationError(message, **kwargs)


def raise_authz_error(message: str = "Access denied", **kwargs):
    """Raise authorization exception"""
    raise AuthorizationError(message, **kwargs)


def raise_conflict_error(message: str, **kwargs):
    """Raise conflict exception"""
    raise ConflictError(message, **kwargs)


def raise_database_error(message: str, **kwargs):
    """Raise database exception"""
    raise DatabaseError(message, **kwargs)


def raise_webdriver_error(message: str, **kwargs):
    """Raise WebDriver exception"""
    raise WebDriverError(message, **kwargs)


def raise_file_error(message: str, **kwargs):
    """Raise file processing exception"""
    raise FileProcessingError(message, **kwargs)


def raise_rate_limit_error(message: str = "Rate limit exceeded", **kwargs):
    """Raise rate limit exception"""
    raise RateLimitError(message, **kwargs)


def raise_service_unavailable(message: str = "Service temporarily unavailable", **kwargs):
    """Raise service unavailable exception"""
    raise ServiceUnavailableError(message, **kwargs)


def raise_business_error(message: str, status_code: int = 400, **kwargs):
    """Raise business logic exception"""
    raise BusinessLogicError(message, status_code, **kwargs)