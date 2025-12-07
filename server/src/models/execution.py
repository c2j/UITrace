"""
Test execution models for tracking script runs and results
"""

from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import String, Boolean, DateTime, UUID as SQLUUID, ForeignKey, Integer, Float, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


class TestExecution(Base):
    """Test execution tracking"""
    __tablename__ = "test_executions"

    id: Mapped[SQLUUID] = mapped_column(
        SQLUUID(as_uuid=True),
        server_default=func.gen_random_uuid(),
        primary_key=True,
        index=True
    )
    script_id: Mapped[SQLUUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("scripts.id"),
        nullable=False,
        index=True
    )
    execution_context: Mapped[Dict[str, Any]] = mapped_column(
        JSON,
        nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="pending"
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    total_duration_ms: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )
    steps_executed: Mapped[int] = mapped_column(
        Integer,
        server_default="0",
        nullable=False
    )
    steps_passed: Mapped[int] = mapped_column(
        Integer,
        server_default="0",
        nullable=False
    )
    steps_failed: Mapped[int] = mapped_column(
        Integer,
        server_default="0",
        nullable=False
    )
    steps_skipped: Mapped[int] = mapped_column(
        Integer,
        server_default="0",
        nullable=False
    )
    visual_difference_score: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    created_by: Mapped[SQLUUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    script = relationship("Script", back_populates="executions")
    creator = relationship("User", foreign_keys=[created_by])
    step_results = relationship("TestStepResult", back_populates="execution")

    def __repr__(self) -> str:
        return f"<TestExecution(id={self.id}, status='{self.status}', script_id={self.script_id})>"


class TestStepResult(Base):
    """Individual test step results"""
    __tablename__ = "test_step_results"

    id: Mapped[SQLUUID] = mapped_column(
        SQLUUID(as_uuid=True),
        server_default=func.gen_random_uuid(),
        primary_key=True,
        index=True
    )
    execution_id: Mapped[SQLUUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("test_executions.id"),
        nullable=False,
        index=True
    )
    step_id: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="pending"
    )
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True
    )
    duration_ms: Mapped[Optional[int]] = mapped_column(
        Integer,
        nullable=True
    )
    used_selector: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    error_message: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    screenshot_baseline: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    screenshot_actual: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    screenshot_diff: Mapped[Optional[str]] = mapped_column(
        String(500),
        nullable=True
    )
    visual_difference_percent: Mapped[Optional[float]] = mapped_column(
        Float,
        nullable=True
    )

    # Relationships
    execution = relationship("TestExecution", back_populates="step_results")

    def __repr__(self) -> str:
        return f"<TestStepResult(id={self.id}, step_id={self.step_id}, status='{self.status}')>"