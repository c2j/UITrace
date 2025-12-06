"""Script model for UITrace platform."""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Script(Base):
    """Script model for test automation."""

    __tablename__ = "scripts"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )

    # Script information
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
    slug: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    tags: Mapped[Optional[List[str]]] = mapped_column(
        JSONB,
        nullable=True,
        default=lambda: []
    )

    # Script content and version
    content: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False
    )
    version: Mapped[int] = mapped_column(
        Integer,
        default=1,
        nullable=False
    )
    language: Mapped[str] = mapped_column(
        String(50),
        default="python",
        nullable=False
    )
    framework: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True
    )

    # Script status and configuration
    status: Mapped[str] = mapped_column(
        String(50),
        default="draft",
        nullable=False
    )
    is_public: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    is_template: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    timeout_seconds: Mapped[int] = mapped_column(
        Integer,
        default=300,
        nullable=False
    )
    retry_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )

    # Lock information
    is_locked: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    locked_by: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    locked_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Execution settings
    default_browser: Mapped[str] = mapped_column(
        String(50),
        default="chrome",
        nullable=False
    )
    default_environment_id: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("environments.id"),
        nullable=True
    )
    execution_config: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=lambda: {}
    )

    # Statistics
    execution_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    last_executed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    success_rate: Mapped[float] = mapped_column(
        default=0.0,
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
    archived_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    created_by: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    updated_by: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )

    # Relationships
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="scripts"
    )
    author: Mapped["User"] = relationship(
        "User",
        back_populates="scripts",
        foreign_keys=[created_by]
    )
    updater: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[updated_by]
    )
    locker: Mapped[Optional["User"]] = relationship(
        "User",
        foreign_keys=[locked_by]
    )
    versions: Mapped[List["ScriptVersion"]] = relationship(
        "ScriptVersion",
        back_populates="script",
        cascade="all, delete-orphan"
    )
    executions: Mapped[List["Execution"]] = relationship(
        "Execution",
        back_populates="script",
        cascade="all, delete-orphan"
    )
    schedules: Mapped[List["ScriptSchedule"]] = relationship(
        "ScriptSchedule",
        back_populates="script",
        cascade="all, delete-orphan"
    )
    baselines: Mapped[List["VisualBaseline"]] = relationship(
        "VisualBaseline",
        back_populates="script",
        cascade="all, delete-orphan"
    )

    # Unique constraint on project_id and slug
    __table_args__ = (
        UniqueConstraint('project_id', 'slug', name='uq_script_project_slug'),
    )

    def __repr__(self) -> str:
        """Represent script as string."""
        return f"<Script(id={self.id}, name={self.name}, version={self.version})>"


class ScriptVersion(Base):
    """Script version history."""

    __tablename__ = "script_versions"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )

    # Version information
    script_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scripts.id"),
        nullable=False,
        index=True
    )
    version: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    content: Mapped[dict] = mapped_column(
        JSONB,
        nullable=False
    )
    change_description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    # Version metadata
    content_diff: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True
    )
    checksum: Mapped[str] = mapped_column(
        String(64),
        nullable=False
    )
    size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    created_by: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )

    # Relationships
    script: Mapped["Script"] = relationship(
        "Script",
        back_populates="versions"
    )
    author: Mapped["User"] = relationship()

    # Unique constraint on script_id and version
    __table_args__ = (
        UniqueConstraint('script_id', 'version', name='uq_script_version'),
    )

    def __repr__(self) -> str:
        """Represent script version as string."""
        return f"<ScriptVersion(id={self.id}, script_id={self.script_id}, version={self.version})>"


class ScriptSchedule(Base):
    """Scheduled execution for scripts."""

    __tablename__ = "script_schedules"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )

    # Schedule information
    script_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scripts.id"),
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

    # Schedule configuration
    cron_expression: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )
    timezone: Mapped[str] = mapped_column(
        String(50),
        default="UTC",
        nullable=False
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )

    # Execution settings
    environment_id: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("environments.id"),
        nullable=True
    )
    browser_type: Mapped[str] = mapped_column(
        String(50),
        default="chrome",
        nullable=False
    )
    execution_config: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=lambda: {}
    )

    # Notification settings
    notify_on_success: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    notify_on_failure: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    notification_emails: Mapped[Optional[List[str]]] = mapped_column(
        JSONB,
        nullable=True
    )

    # Statistics
    next_run_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    last_run_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    total_runs: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    successful_runs: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    failed_runs: Mapped[int] = mapped_column(
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
    updated_by: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )

    # Relationships
    script: Mapped["Script"] = relationship(
        "Script",
        back_populates="schedules"
    )
    environment: Mapped[Optional["Environment"]] = relationship()
    creator: Mapped["User"] = relationship(
        foreign_keys=[created_by]
    )
    updater: Mapped[Optional["User"]] = relationship(
        foreign_keys=[updated_by]
    )

    def __repr__(self) -> str:
        """Represent script schedule as string."""
        return f"<ScriptSchedule(id={self.id}, script_id={self.script_id}, cron={self.cron_expression})>"


class VisualBaseline(Base):
    """Visual baseline for screenshot comparison."""

    __tablename__ = "visual_baselines"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )

    # Baseline information
    script_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scripts.id"),
        nullable=False,
        index=True
    )
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    step_identifier: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    # Baseline configuration
    image_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )
    thumbnail_path: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    similarity_threshold: Mapped[float] = mapped_column(
        default=0.98,
        nullable=False
    )
    comparison_mode: Mapped[str] = mapped_column(
        String(50),
        default="pixel",
        nullable=False
    )
    ignore_areas: Mapped[Optional[List[dict]]] = mapped_column(
        JSONB,
        nullable=True
    )

    # Browser and viewport
    browser_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )
    browser_version: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True
    )
    viewport_width: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    viewport_height: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    device_pixel_ratio: Mapped[float] = mapped_column(
        default=1.0,
        nullable=False
    )

    # Status
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        default=True,
        nullable=False
    )
    is_stable: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )

    # Statistics
    comparison_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )
    last_compared_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
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
    created_by: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    approved_by: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    approved_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Relationships
    script: Mapped["Script"] = relationship(
        "Script",
        back_populates="baselines"
    )
    creator: Mapped["User"] = relationship(
        foreign_keys=[created_by]
    )
    approver: Mapped[Optional["User"]] = relationship(
        foreign_keys=[approved_by]
    )
    comparisons: Mapped[List["VisualComparison"]] = relationship(
        "VisualComparison",
        back_populates="baseline",
        cascade="all, delete-orphan"
    )

    # Unique constraint on script_id and step_identifier
    __table_args__ = (
        UniqueConstraint('script_id', 'step_identifier', name='uq_baseline_script_step'),
    )

    def __repr__(self) -> str:
        """Represent visual baseline as string."""
        return f"<VisualBaseline(id={self.id}, script_id={self.script_id}, step={self.step_identifier})>"


class VisualComparison(Base):
    """Visual comparison results."""

    __tablename__ = "visual_comparisons"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )

    # Comparison information
    baseline_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("visual_baselines.id"),
        nullable=False,
        index=True
    )
    execution_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("executions.id"),
        nullable=False,
        index=True
    )
    step_id: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True
    )

    # Comparison images
    current_image_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )
    diff_image_path: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    thumbnail_path: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )

    # Comparison results
    similarity_score: Mapped[float] = mapped_column(
        nullable=False
    )
    passed_threshold: Mapped[bool] = mapped_column(
        nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(50),
        default="pending",
        nullable=False
    )
    mismatch_percentage: Mapped[float] = mapped_column(
        default=0.0,
        nullable=False
    )

    # Comparison metadata
    comparison_algorithm: Mapped[str] = mapped_column(
        String(50),
        default="pixel",
        nullable=False
    )
    comparison_time_ms: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    pixel_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    diff_pixel_count: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False
    )

    # Status
    reviewed: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    approved: Mapped[Optional[bool]] = mapped_column(
        Boolean,
        nullable=True
    )
    notes: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    reviewed_by: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )

    # Relationships
    baseline: Mapped["VisualBaseline"] = relationship(
        "VisualBaseline",
        back_populates="comparisons"
    )
    execution: Mapped["Execution"] = relationship()
    reviewer: Mapped[Optional["User"]] = relationship()

    def __repr__(self) -> str:
        """Represent visual comparison as string."""
        return f"<VisualComparison(id={self.id}, baseline_id={self.baseline_id}, score={self.similarity_score})>"