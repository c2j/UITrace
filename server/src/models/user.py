"""
User management models
"""

from datetime import datetime
from typing import Optional
from sqlalchemy import String, Boolean, DateTime, UUID as SQLUUID
from sqlalchemy.sql import func

from sqlalchemy.orm import Mapped, mapped_column

from ..core.database import Base


class User(Base):
    """User model for authentication and authorization"""
    __tablename__ = "users"

    id: Mapped[SQLUUID] = mapped_column(
        SQLUUID(as_uuid=True),
        server_default=func.gen_random_uuid(),
        primary_key=True,
        index=True
    )
    username: Mapped[str] = mapped_column(
        String(50),
        unique=True,
        index=True,
        nullable=False
    )
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False
    )
    full_name: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )
    password_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="tester"
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        server_default="true",
        nullable=False
    )
    last_login: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"