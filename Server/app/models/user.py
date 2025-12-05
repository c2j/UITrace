"""
User models for database
"""

from sqlalchemy import Column, String, Boolean, DateTime, Enum, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid
import enum

from app.db import Base


class UserRole(enum.Enum):
    """User role enumeration"""
    ADMIN = "admin"
    TESTER = "tester"
    VIEWER = "viewer"


class User(Base):
    """User model"""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # NULL for OAuth2 users
    oauth_provider = Column(String(50), nullable=True)  # 'google', 'github', 'microsoft'
    oauth_id = Column(String(255), nullable=True, index=True)  # Provider-specific user ID
    full_name = Column(String(255), nullable=True)
    role = Column(Enum(UserRole), nullable=False, default=UserRole.TESTER)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    avatar_url = Column(String(500), nullable=True)
    timezone = Column(String(50), default="UTC", nullable=False)
    language = Column(String(10), default="en", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)
    last_seen = Column(DateTime(timezone=True), nullable=True)

    def __repr__(self):
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"

    def to_dict(self):
        """Convert to dictionary"""
        return {
            "id": str(self.id),
            "email": self.email,
            "username": self.username,
            "full_name": self.full_name,
            "role": self.role.value,
            "is_active": self.is_active,
            "is_verified": self.is_verified,
            "avatar_url": self.avatar_url,
            "timezone": self.timezone,
            "language": self.language,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "last_login": self.last_login.isoformat() if self.last_login else None,
            "last_seen": self.last_seen.isoformat() if self.last_seen else None,
        }


class Team(Base):
    """Team model for user organization"""
    __tablename__ = "teams"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    avatar_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(UUID(as_uuid=True), nullable=True)  # Reference to User
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<Team(id={self.id}, name='{self.name}')>"


class TeamMemberRole(enum.Enum):
    """Team member role enumeration"""
    OWNER = "owner"
    MAINTAINER = "maintainer"
    MEMBER = "member"
    VIEWER = "viewer"


class TeamMember(Base):
    """Team membership model"""
    __tablename__ = "team_members"

    team_id = Column(UUID(as_uuid=True), primary_key=True)
    user_id = Column(UUID(as_uuid=True), primary_key=True)
    role = Column(Enum(TeamMemberRole), nullable=False, default=TeamMemberRole.MEMBER)
    joined_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    invited_by = Column(UUID(as_uuid=True), nullable=True)  # Reference to User

    def __repr__(self):
        return f"<TeamMember(team_id={self.team_id}, user_id={self.user_id}, role={self.role})>"