"""User model and related schemas."""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text, event
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class User(Base):
    """User model for authentication and authorization."""

    __tablename__ = "users"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )

    # User information
    email: Mapped[str] = mapped_column(
        String(255),
        unique=True,
        index=True,
        nullable=False
    )
    username: Mapped[Optional[str]] = mapped_column(
        String(100),
        unique=True,
        index=True,
        nullable=True
    )
    full_name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    avatar_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )

    # Authentication fields
    hashed_password: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    is_superuser: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    is_verified: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )

    # OAuth fields
    oauth_provider: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True
    )
    oauth_id: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )

    # Role and permissions
    role: Mapped[str] = mapped_column(
        String(50),
        default="user",
        nullable=False
    )
    permissions: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True
    )

    # Preferences
    preferences: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=lambda: {"theme": "light", "language": "en"}
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
    last_login_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Relationships
    projects: Mapped[List["Project"]] = relationship(
        "Project",
        back_populates="owner",
        cascade="all, delete-orphan"
    )
    team_memberships: Mapped[List["TeamMember"]] = relationship(
        "TeamMember",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    owned_teams: Mapped[List["Team"]] = relationship(
        "Team",
        back_populates="owner",
        cascade="all, delete-orphan"
    )
    scripts: Mapped[List["Script"]] = relationship(
        "Script",
        back_populates="author",
        cascade="all, delete-orphan"
    )
    executions: Mapped[List["Execution"]] = relationship(
        "Execution",
        back_populates="executed_by",
        cascade="all, delete-orphan"
    )
    api_keys: Mapped[List["APIKey"]] = relationship(
        "APIKey",
        back_populates="user",
        cascade="all, delete-orphan"
    )
    sessions: Mapped[List["UserSession"]] = relationship(
        "UserSession",
        back_populates="user",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        """Represent user as string."""
        return f"<User(id={self.id}, email={self.email}, is_active={self.is_active})>"


class APIKey(Base):
    """API keys for programmatic access."""

    __tablename__ = "api_keys"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )
    key_hash: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True
    )
    prefix: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )
    permissions: Mapped[Optional[List[str]]] = mapped_column(
        JSONB,
        nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    last_used_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    created_by: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False
    )

    # Relationship
    user: Mapped["User"] = relationship(
        "User",
        back_populates="api_keys"
    )


class UserSession(Base):
    """User sessions for tracking active sessions."""

    __tablename__ = "user_sessions"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True
    )
    session_token: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
        unique=True
    )
    refresh_token: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    ip_address: Mapped[Optional[str]] = mapped_column(
        String(45),
        nullable=True
    )
    user_agent: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    expires_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    last_accessed_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationship
    user: Mapped["User"] = relationship(
        "User",
        back_populates="sessions"
    )


class Team(Base):
    """Team model for collaboration."""

    __tablename__ = "teams"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )
    slug: Mapped[str] = mapped_column(
        String(100),
        unique=True,
        nullable=False,
        index=True
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    avatar_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    owner_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    settings: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=lambda: {}
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )

    # Relationships
    owner: Mapped["User"] = relationship(
        "User",
        back_populates="owned_teams"
    )
    members: Mapped[List["TeamMember"]] = relationship(
        "TeamMember",
        back_populates="team",
        cascade="all, delete-orphan"
    )
    projects: Mapped[List["Project"]] = relationship(
        "Project",
        back_populates="team",
        cascade="all, delete-orphan"
    )


class TeamMember(Base):
    """Team membership model."""

    __tablename__ = "team_members"

    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )
    team_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False,
        index=True
    )
    role: Mapped[str] = mapped_column(
        String(50),
        default="member",
        nullable=False
    )
    permissions: Mapped[Optional[List[str]]] = mapped_column(
        JSONB,
        nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    invited_by: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        nullable=False
    )
    joined_at: Mapped[Optional[datetime]] = mapped_column(
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
        onupdate=func.now(),
        nullable=False
    )

    # Relationships
    team: Mapped["Team"] = relationship(
        "Team",
        back_populates="members"
    )
    user: Mapped["User"] = relationship(
        "User",
        back_populates="team_memberships"
    )