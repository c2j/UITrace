"""Project model for UITrace platform."""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Project(Base):
    """Project model for organizing test scripts and executions."""

    __tablename__ = "projects"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )

    # Project information
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

    # Ownership and team
    owner_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )
    team_id: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("teams.id"),
        nullable=True,
        index=True
    )

    # Project settings
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    is_public: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    data_retention_months: Mapped[int] = mapped_column(
        Integer,
        default=12,
        nullable=False
    )
    settings: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=lambda: {}
    )

    # Quotas
    max_scripts: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )
    max_executions_per_day: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
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
    archived_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Relationships
    owner: Mapped["User"] = relationship(
        "User",
        back_populates="projects"
    )
    team: Mapped[Optional["Team"]] = relationship(
        "Team",
        back_populates="projects"
    )
    scripts: Mapped[List["Script"]] = relationship(
        "Script",
        back_populates="project",
        cascade="all, delete-orphan"
    )
    executions: Mapped[List["Execution"]] = relationship(
        "Execution",
        back_populates="project",
        cascade="all, delete-orphan"
    )
    data_files: Mapped[List["DataFile"]] = relationship(
        "DataFile",
        back_populates="project",
        cascade="all, delete-orphan"
    )
    environments: Mapped[List["Environment"]] = relationship(
        "Environment",
        back_populates="project",
        cascade="all, delete-orphan"
    )
    webhooks: Mapped[List["Webhook"]] = relationship(
        "Webhook",
        back_populates="project",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        """Represent project as string."""
        return f"<Project(id={self.id}, name={self.name}, slug={self.slug})>"


class Environment(Base):
    """Environment configuration for projects."""

    __tablename__ = "environments"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )

    # Environment information
    project_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id"),
        nullable=False,
        index=True
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )
    slug: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    # Environment configuration
    base_url: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    variables: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=lambda: {}
    )
    headers: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=lambda: {}
    )
    credentials: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True
    )

    # Environment type
    environment_type: Mapped[str] = mapped_column(
        String(50),
        default="testing",
        nullable=False
    )
    is_default: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
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
    created_by: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    # Relationships
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="environments"
    )
    creator: Mapped["User"] = relationship()


class DataFile(Base):
    """Data files for parameterized testing."""

    __tablename__ = "data_files"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )

    # File information
    project_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id"),
        nullable=False,
        index=True
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    file_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )
    file_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )
    file_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    # File metadata
    headers: Mapped[Optional[List[dict]]] = mapped_column(
        JSONB,
        nullable=True
    )
    row_count: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )
    column_count: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )
    checksum: Mapped[str] = mapped_column(
        String(64),
        nullable=False
    )

    # File status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    is_processed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
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
    created_by: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    # Relationships
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="data_files"
    )
    creator: Mapped["User"] = relationship()


class Webhook(Base):
    """Webhooks for project events."""

    __tablename__ = "webhooks"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )

    # Webhook information
    project_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id"),
        nullable=False,
        index=True
    )
    name: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )
    url: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    # Webhook configuration
    events: Mapped[List[str]] = mapped_column(
        JSONB,
        nullable=False,
        default=lambda: []
    )
    secret: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    headers: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=lambda: {}
    )

    # Webhook status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    retry_count: Mapped[int] = mapped_column(
        Integer,
        default=3,
        nullable=False
    )
    timeout_seconds: Mapped[int] = mapped_column(
        Integer,
        default=30,
        nullable=False
    )

    # Statistics
    last_triggered_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    trigger_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    failure_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
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
    created_by: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    # Relationships
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="webhooks"
    )
    creator: Mapped["User"] = relationship()