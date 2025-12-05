"""
Database session management for UITrace Server
"""

from sqlalchemy import create_engine
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from typing import AsyncGenerator
import structlog

from app.core.config import settings

logger = structlog.get_logger()

# Create base class for models
Base = declarative_base()

# Create async engine
if settings.DATABASE_URL.startswith("sqlite:///"):
    # SQLite async support
    engine = create_async_engine(
        settings.DATABASE_URL.replace("sqlite:///", "sqlite+aiosqlite:///"),
        echo=settings.DEBUG,
    )
elif settings.DATABASE_URL.startswith("postgresql://"):
    # PostgreSQL async support
    engine = create_async_engine(
        settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"),
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        pool_timeout=settings.DATABASE_POOL_TIMEOUT,
        pool_pre_ping=True,
        echo=settings.DEBUG,
    )
else:
    raise ValueError(f"Unsupported database URL: {settings.DATABASE_URL}")

# Create session factory
async_session_maker = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get database session for dependency injection"""
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error("Database session error", error=str(e))
            raise
        finally:
            await session.close()


async def init_db():
    """Initialize database tables"""
    try:
        async with engine.begin() as conn:
            # Import all models to ensure they are registered
            from app.models import user, project, test_script, test_execution, screenshot, audit_log

            # Create all tables
            await conn.run_sync(Base.metadata.create_all)
            logger.info("Database tables created successfully")
    except Exception as e:
        logger.error("Failed to initialize database", error=str(e))
        raise


async def drop_db():
    """Drop all database tables (use with caution)"""
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.drop_all)
            logger.info("Database tables dropped successfully")
    except Exception as e:
        logger.error("Failed to drop database", error=str(e))
        raise


async def get_session() -> AsyncSession:
    """Get database session for use in services"""
    async with async_session_maker() as session:
        return session