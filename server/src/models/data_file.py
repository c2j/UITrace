"""
Data file management models for CSV/Excel test data
"""

from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy import String, Boolean, DateTime, UUID as SQLUUID, ForeignKey, Integer, JSON, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..core.database import Base


class DataFile(Base):
    """Data file model for test data management"""
    __tablename__ = "data_files"

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
    file_type: Mapped[str] = mapped_column(
        String(10),
        nullable=False
    )
    columns: Mapped[Dict[str, Any]] = mapped_column(
        JSON,
        nullable=False
    )
    row_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    file_size_bytes: Mapped[int] = mapped_column(
        Integer,
        nullable=False
    )
    checksum: Mapped[str] = mapped_column(
        String(64),
        nullable=False
    )
    file_path: Mapped[str] = mapped_column(
        String(500),
        nullable=False
    )
    uploaded_by: Mapped[SQLUUID] = mapped_column(
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
    uploader = relationship("User")

    def __repr__(self) -> str:
        return f"<DataFile(id={self.id}, name='{self.name}', type='{self.file_type}')>"