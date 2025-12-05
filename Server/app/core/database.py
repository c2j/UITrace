"""
Database configuration and session management
"""

from sqlalchemy import create_engine, MetaData
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from typing import Generator
import structlog

from app.core.config import settings

logger = structlog.get_logger()

# Create database engine with connection pooling
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_size=settings.DATABASE_POOL_SIZE,
    max_overflow=settings.DATABASE_MAX_OVERFLOW,
    pool_timeout=settings.DATABASE_POOL_TIMEOUT,
    pool_pre_ping=True,  # Verify connections before using them
    echo=settings.DEBUG,  # SQL logging in debug mode
)

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

# Create base class for models
Base = declarative_base()
metadata = MetaData(schema="uitrace")


def get_db() -> Generator[Session, None, None]:
    """Get database session"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Initialize database - create all tables"""
    logger.info("Initializing database")
    Base.metadata.create_all(bind=engine)
    logger.info("Database initialization complete")


def drop_db():
    """Drop all database tables - use with caution"""
    logger.warning("Dropping all database tables")
    Base.metadata.drop_all(bind=engine)
    logger.info("Database tables dropped")


def check_db_connection() -> bool:
    """Check if database connection is working"""
    try:
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        logger.info("Database connection check successful")
        return True
    except Exception as e:
        logger.error("Database connection check failed", error=str(e))
        return False