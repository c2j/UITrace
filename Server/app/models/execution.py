"""Execution model for UITrace platform."""

from datetime import datetime
from typing import List, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


class Execution(Base):
    """Test execution model."""

    __tablename__ = "executions"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )

    # Execution information
    project_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id"),
        nullable=False,
        index=True
    )
    script_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("scripts.id"),
        nullable=False,
        index=True
    )
    name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    # Execution configuration
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
    browser_version: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True
    )
    execution_mode: Mapped[str] = mapped_column(
        String(50),
        default="sequential",
        nullable=False
    )
    execution_config: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True,
        default=lambda: {}
    )
    data_file_id: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True
    )
    data_rows: Mapped[Optional[List[int]]] = mapped_column(
        JSONB,
        nullable=True
    )

    # Execution status
    status: Mapped[str] = mapped_column(
        String(50),
        default="pending",
        nullable=False
    )
    progress_percentage: Mapped[float] = mapped_column(
        default=0.0,
        nullable=False
    )
    current_step: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )
    total_steps: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )

    # Execution results
    result_status: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True
    )
    exit_code: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    error_stack_trace: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    # Timing information
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    duration_ms: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )
    timeout_seconds: Mapped[int] = mapped_column(
        default=300,
        nullable=False
    )

    # Statistics
    total_test_cases: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )
    passed_test_cases: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )
    failed_test_cases: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )
    skipped_test_cases: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )
    total_steps: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )
    passed_steps: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )
    failed_steps: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )
    skipped_steps: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )

    # Visual testing
    screenshots_taken: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )
    visual_comparisons: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )
    visual_passed: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )
    visual_failed: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )

    # Execution metadata
    worker_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )
    session_id: Mapped[Optional[str]] = mapped_column(
        String(100),
        nullable=True
    )
    retry_count: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )
    is_retry: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    original_execution_id: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True
    )

    # Trigger information
    trigger_type: Mapped[str] = mapped_column(
        String(50),
        default="manual",
        nullable=False
    )
    triggered_by: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=True
    )
    schedule_id: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True
    )
    webhook_id: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True
    )

    # Artifacts
    artifact_paths: Mapped[Optional[List[str]]] = mapped_column(
        JSONB,
        nullable=True
    )
    report_path: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    video_path: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    logs_path: Mapped[Optional[str]] = mapped_column(
        String(500),
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

    # Relationships
    project: Mapped["Project"] = relationship(
        "Project",
        back_populates="executions"
    )
    script: Mapped["Script"] = relationship(
        "Script",
        back_populates="executions"
    )
    environment: Mapped[Optional["Environment"]] = relationship()
    data_file: Mapped[Optional["DataFile"]] = relationship()
    executed_by: Mapped[Optional["User"]] = relationship(
        foreign_keys=[triggered_by]
    )
    test_cases: Mapped[List["TestCase"]] = relationship(
        "TestCase",
        back_populates="execution",
        cascade="all, delete-orphan"
    )
    steps: Mapped[List["ExecutionStep"]] = relationship(
        "ExecutionStep",
        back_populates="execution",
        cascade="all, delete-orphan"
    )
    artifacts: Mapped[List["ExecutionArtifact"]] = relationship(
        "ExecutionArtifact",
        back_populates="execution",
        cascade="all, delete-orphan"
    )
    comparisons: Mapped[List["VisualComparison"]] = relationship(
        "VisualComparison",
        back_populates="execution",
        cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        """Represent execution as string."""
        return f"<Execution(id={self.id}, script_id={self.script_id}, status={self.status})>"


class TestCase(Base):
    """Test case within an execution."""

    __tablename__ = "test_cases"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )

    # Test case information
    execution_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("executions.id"),
        nullable=False,
        index=True
    )
    name: Mapped[Optional[str]] = mapped_column(
        String(255),
        nullable=True
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    test_index: Mapped[int] = mapped_column(
        nullable=False
    )
    data_row_index: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )

    # Test case data
    test_data: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True
    )

    # Status and results
    status: Mapped[str] = mapped_column(
        String(50),
        default="pending",
        nullable=False
    )
    result_status: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    error_stack_trace: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    # Timing information
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    duration_ms: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )

    # Statistics
    total_steps: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )
    passed_steps: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )
    failed_steps: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )
    skipped_steps: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )

    # Visual testing
    screenshots_taken: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )
    visual_comparisons: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )
    visual_passed: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )
    visual_failed: Mapped[int] = mapped_column(
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

    # Relationships
    execution: Mapped["Execution"] = relationship(
        "Execution",
        back_populates="test_cases"
    )
    steps: Mapped[List["ExecutionStep"]] = relationship(
        "ExecutionStep",
        back_populates="test_case",
        cascade="all, delete-orphan"
    )
    artifacts: Mapped[List["ExecutionArtifact"]] = relationship(
        "ExecutionArtifact",
        back_populates="test_case",
        cascade="all, delete-orphan"
    )

    # Unique constraint on execution_id and test_index
    __table_args__ = (
        UniqueConstraint('execution_id', 'test_index', name='uq_testcase_execution_index'),
    )

    def __repr__(self) -> str:
        """Represent test case as string."""
        return f"<TestCase(id={self.id}, execution_id={self.execution_id}, status={self.status})>"


class ExecutionStep(Base):
    """Execution step within a test case."""

    __tablename__ = "execution_steps"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )

    # Step information
    execution_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("executions.id"),
        nullable=False,
        index=True
    )
    test_case_id: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("test_cases.id"),
        nullable=True
    )
    step_index: Mapped[int] = mapped_column(
        nullable=False
    )
    step_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    # Step configuration
    target_element: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True
    )
    action_data: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True
    )
    expected_result: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True
    )
    timeout_ms: Mapped[int] = mapped_column(
        default=5000,
        nullable=False
    )
    retry_count: Mapped[int] = mapped_column(
        default=0,
        nullable=False
    )

    # Status and results
    status: Mapped[str] = mapped_column(
        String(50),
        default="pending",
        nullable=False
    )
    result_status: Mapped[Optional[str]] = mapped_column(
        String(50),
        nullable=True
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    error_stack_trace: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )

    # Timing information
    started_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    duration_ms: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )

    # Screenshots and visual data
    screenshot_before_path: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    screenshot_after_path: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    visual_comparison_id: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        nullable=True
    )

    # Step data
    input_data: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True
    )
    output_data: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True
    )
    metadata: Mapped[Optional[dict]] = mapped_column(
        JSONB,
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

    # Relationships
    execution: Mapped["Execution"] = relationship(
        "Execution",
        back_populates="steps"
    )
    test_case: Mapped[Optional["TestCase"]] = relationship(
        "TestCase",
        back_populates="steps"
    )
    artifacts: Mapped[List["ExecutionArtifact"]] = relationship(
        "ExecutionArtifact",
        back_populates="step",
        cascade="all, delete-orphan"
    )
    visual_comparison: Mapped[Optional["VisualComparison"]] = relationship()

    # Unique constraint on execution_id and step_index
    __table_args__ = (
        UniqueConstraint('execution_id', 'step_index', name='uq_step_execution_index'),
    )

    def __repr__(self) -> str:
        """Represent execution step as string."""
        return f"<ExecutionStep(id={self.id}, step_type={self.step_type}, status={self.status})>"


class ExecutionArtifact(Base):
    """Artifacts generated during execution."""

    __tablename__ = "execution_artifacts"

    # Primary key
    id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        index=True
    )

    # Artifact information
    execution_id: Mapped[UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("executions.id"),
        nullable=False,
        index=True
    )
    test_case_id: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("test_cases.id"),
        nullable=True
    )
    step_id: Mapped[Optional[UUID]] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("execution_steps.id"),
        nullable=True
    )

    # Artifact details
    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    artifact_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False
    )
    mime_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False
    )
    file_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )
    file_size: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    checksum: Mapped[str] = mapped_column(
        String(64),
        nullable=False
    )

    # Artifact metadata
    metadata: Mapped[Optional[dict]] = mapped_column(
        JSONB,
        nullable=True
    )
    is_public: Mapped[bool] = mapped_column(
        Boolean,
        default=False,
        nullable=False
    )
    retention_days: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )

    # Relationships
    execution: Mapped["Execution"] = relationship(
        "Execution",
        back_populates="artifacts"
    )
    test_case: Mapped[Optional["TestCase"]] = relationship(
        "TestCase",
        back_populates="artifacts"
    )
    step: Mapped[Optional["ExecutionStep"]] = relationship(
        "ExecutionStep",
        back_populates="artifacts"
    )

    def __repr__(self) -> str:
        """Represent execution artifact as string."""
        return f"<ExecutionArtifact(id={self.id}, type={self.artifact_type}, file_path={self.file_path})>"