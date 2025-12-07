"""
Project management models
"""

from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import String, Boolean, DateTime, UUID as SQLUUID, ForeignKey, JSON, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


class Project(Base):
    """Project model for organizing scripts and team collaboration"""
    __tablename__ = "projects"

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
    owner_id: Mapped[SQLUUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False,
        index=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        server_default="true",
        nullable=False
    )
    settings: Mapped[Dict[str, Any]] = mapped_column(
        JSON,
        default=dict,
        nullable=False
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
    owner = relationship("User", back_populates="owned_projects")
    scripts = relationship("Script", back_populates="project")
    user_roles = relationship("UserProjectRole", back_populates="project")

    def __repr__(self) -> str:
        return f"<Project(id={self.id}, name='{self.name}', owner_id={self.owner_id})>"


class UserProjectRole(Base):
    """User project roles and permissions"""
    __tablename__ = "user_project_roles"

    user_id: Mapped[SQLUUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("users.id"),
        primary_key=True
    )
    project_id: Mapped[SQLUUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("projects.id"),
        primary_key=True
    )
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False
    )
    granted_by: Mapped[SQLUUID] = mapped_column(
        SQLUUID(as_uuid=True),
        ForeignKey("users.id"),
        nullable=False
    )
    granted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )

    # Relationships
    user = relationship("User", back_populates="project_roles")
    project = relationship("Project", back_populates="user_roles")
    granter = relationship("User", foreign_keys=[granted_by])

    def __repr__(self) -> str:
        return f"<UserProjectRole(user_id={self.user_id}, project_id={self.project_id}, role='{self.role}')>"