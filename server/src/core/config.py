"""
Configuration management for UITrace Server
"""

import os
from functools import lru_cache
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import field_validator


class Settings(BaseSettings):
    """Application settings with environment variable support"""

    # Application
    NAME: str = "UITrace Server"
    VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 1

    # Database
    DATABASE_URL: str = "postgresql://uitrace:password@localhost:5432/uitrace"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 30

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_POOL_SIZE: int = 10

    # Security
    SECRET_KEY: str = "change-in-production-secret-key"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:1420"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["*"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]

    # File Upload
    MAX_UPLOAD_SIZE: int = 100 * 1024 * 1024  # 100MB
    ALLOWED_FILE_TYPES: List[str] = ["csv", "xlsx", "xls"]
    UPLOAD_DIR: str = "uploads"

    # Browser Drivers
    SELENIUM_HUB_URL: str = "http://localhost:4444"
    BROWSER_TIMEOUT_SECONDS: int = 30
    MAX_CONCURRENT_EXECUTIONS: int = 10

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    LOG_FILE: Optional[str] = None

    # Monitoring
    PROMETHEUS_ENABLED: bool = False
    PROMETHEUS_PORT: int = 9090

    # Features
    VISUAL_DIFFERENCE_TOLERANCE: float = 5.0
    SCREENSHOT_FORMAT: str = "png"
    SCRIPT_TIMEOUT_SECONDS: int = 300
    MAX_RETRY_ATTEMPTS: int = 3

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, list):
            return v
        raise ValueError("CORS_ORIGINS must be a list or comma-separated string")

    @field_validator("ENVIRONMENT", mode="before")
    @classmethod
    def validate_environment(cls, v):
        valid_environments = ["development", "staging", "production"]
        if v not in valid_environments:
            raise ValueError(f"ENVIRONMENT must be one of {valid_environments}")
        return v

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False
        extra = "ignore"


# Create global settings instance
settings = Settings()


@lru_cache()
def get_database_url() -> str:
    """Get database URL with appropriate driver"""
    url = settings.DATABASE_URL
    if url.startswith("postgresql://") and not url.startswith("postgresql+asyncpg://"):
        # Convert to asyncpg driver
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


@lru_cache()
def get_redis_url() -> str:
    """Get Redis connection URL"""
    return settings.REDIS_URL


def is_development() -> bool:
    """Check if running in development mode"""
    return settings.ENVIRONMENT == "development"


def is_production() -> bool:
    """Check if running in production mode"""
    return settings.ENVIRONMENT == "production"


def get_cors_origins() -> List[str]:
    """Get CORS origins list"""
    return settings.CORS_ORIGINS