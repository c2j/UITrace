"""
Configuration management for UITrace Server
"""

from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import validator
from pydantic.networks import AnyHttpUrl
import os


class Settings(BaseSettings):
    """Application settings"""

    # Application
    APP_NAME: str = "UITrace Server"
    APP_DESCRIPTION: str = "UI Automation Testing Platform API"
    APP_VERSION: str = "0.1.0"
    DEBUG: bool = False

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LOG_LEVEL: str = "INFO"

    # Security
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # CORS
    CORS_ORIGINS: List[AnyHttpUrl] = []
    ALLOWED_HOSTS: List[str] = ["*"]

    # Database
    DATABASE_URL: str = "sqlite:///./uitrace.db"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 40
    DATABASE_POOL_TIMEOUT: int = 30

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_POOL_SIZE: int = 10
    REDIS_TIMEOUT: int = 5

    # File Storage
    UPLOAD_DIR: str = "storage/uploads"
    MAX_FILE_SIZE_MB: int = 50
    ALLOWED_FILE_TYPES: List[str] = ["csv", "xlsx", "xls", "json", "png", "jpg", "jpeg"]

    # WebDriver
    WEBDRIVER_HUB_URL: str = "http://localhost:4444/wd/hub"
    WEBDRIVER_TIMEOUT: int = 30
    WEBDRIVER_RETRY_ATTEMPTS: int = 3

    # Visual Testing
    VISUAL_BASELINE_DIR: str = "storage/baselines"
    VISUAL_SCREENSHOT_DIR: str = "storage/screenshots"
    VISUAL_SIMILARITY_THRESHOLD: float = 0.98

    # Email (for notifications)
    SMTP_SERVER: Optional[str] = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: Optional[str] = None
    SMTP_PASSWORD: Optional[str] = None
    SMTP_FROM_EMAIL: Optional[str] = None

    # OAuth Providers
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    MICROSOFT_CLIENT_ID: Optional[str] = None
    MICROSOFT_CLIENT_SECRET: Optional[str] = None

    # Performance
    RATE_LIMIT_PER_MINUTE: int = 100
    REQUEST_TIMEOUT: int = 30

    # Data Retention
    EXECUTION_RETENTION_DAYS: int = 90
    AUDIT_LOG_RETENTION_DAYS: int = 180

    @validator("CORS_ORIGINS", pre=True)
    def assemble_cors_origins(cls, v: str | List[str]) -> List[str] | str:
        """Parse CORS origins from environment variable"""
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    @validator("SECRET_KEY", pre=True)
    def validate_secret_key(cls, v: str) -> str:
        """Validate that secret key is not the default in production"""
        if v == "your-secret-key-here-change-in-production" and not os.getenv("DEBUG", "False").lower() == "true":
            raise ValueError("SECRET_KEY must be changed in production")
        return v

    @validator("DATABASE_URL", pre=True)
    def validate_database_url(cls, v: str) -> str:
        """Validate database URL format"""
        if not (v.startswith("postgresql://") or v.startswith("sqlite:///")):
            raise ValueError("DATABASE_URL must be a PostgreSQL or SQLite connection string")
        return v

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Create settings instance
settings = Settings()


def get_settings() -> Settings:
    """Get application settings"""
    return settings