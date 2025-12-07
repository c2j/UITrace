"""
Script management models
"""

from datetime import datetime
from typing import Optional, List, Dict, Any
from sqlalchemy import String, Boolean, DateTime, UUID as SQLUUID, Integer, ForeignKey, Text, JSON
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


class Script(Base):
    """Script model for test script management"""
    __tablename__ = "scripts"

    id: Mapped[SQLUUID] = mapped_column(
        SQLUUID(as_uuid=True),
        server_default=func.gen_random_uuid(),
        primary_key=True,
        index=True
    )
    name: Mapped[str] = mapped_column(
        String(200),
        nullable=False,
        index=True
    )
    description: Mapped[Optional[str]] = mapped_column(
        Text,
        nullable=True
    )
    version: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="1.0.0"
    )
    author_id: Mapped[SQLUUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )
    project_id: Mapped[Optional[SQLUUID]] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("projects.id"),
        nullable=True,
        index=True
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        server_default="draft"
    )
    tags: Mapped[str] = mapped_column(
        String(1000),
        nullable=True,
        server_default=""
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

    # Relationships
    author = relationship("User", back_populates="scripts")
    project = relationship("Project", back_populates="scripts")
    content = relationship("ScriptContent", back_populates="script", uselist=False)
    executions = relationship("TestExecution", back_populates="script")

    def __repr__(self) -> str:
        return f"<Script(id={self.id}, name='{self.name}', version='{self.version}')>"


class ScriptContent(Base):
    """Script content storage with versioning"""
    __tablename__ = "script_content"

    script_id: Mapped[SQLUUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("scripts.id"),
        primary_key=True
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False
    )
    checksum: Mapped[str] = mapped_column(
        String(64),
        nullable=False
    )
    content_type: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        server_default="application/json"
    )
    size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    script = relationship("Script", back_populates="content")

    def __repr__(self) -> str:
        return f"<ScriptContent(script_id={self.script_id}, size={self.size_bytes}>"