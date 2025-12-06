"""User schemas for API validation and serialization."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, validator


class UserBase(BaseModel):
    """Base user schema."""
    email: EmailStr = Field(..., description="User email address")
    username: Optional[str] = Field(None, description="Unique username")
    full_name: Optional[str] = Field(None, description="User's full name")
    avatar_url: Optional[str] = Field(None, description="URL to user's avatar image")
    is_active: bool = Field(True, description="Whether the user account is active")
    role: str = Field("user", description="User role")


class UserCreate(UserBase):
    """Schema for creating a new user."""
    password: str = Field(..., min_length=8, description="User password")

    @validator("password")
    def validate_password(cls, v):
        """Validate password strength."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserUpdate(BaseModel):
    """Schema for updating a user."""
    username: Optional[str] = Field(None, description="Unique username")
    full_name: Optional[str] = Field(None, description="User's full name")
    avatar_url: Optional[str] = Field(None, description="URL to user's avatar image")
    is_active: Optional[bool] = Field(None, description="Whether the user account is active")
    role: Optional[str] = Field(None, description="User role")
    preferences: Optional[dict] = Field(None, description="User preferences")


class UserUpdatePassword(BaseModel):
    """Schema for updating user password."""
    current_password: str = Field(..., description="Current password")
    new_password: str = Field(..., min_length=8, description="New password")

    @validator("new_password")
    def validate_password(cls, v):
        """Validate password strength."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserInDB(UserBase):
    """Schema for user as stored in database."""
    id: str
    is_verified: bool
    is_superuser: bool
    oauth_provider: Optional[str] = None
    oauth_id: Optional[str] = None
    preferences: Optional[dict] = None
    created_at: datetime
    updated_at: datetime
    last_login_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class User(UserInDB):
    """Schema for user response."""
    pass


class UserPublic(BaseModel):
    """Schema for public user information."""
    id: str
    username: Optional[str] = None
    full_name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str

    class Config:
        from_attributes = True


class UserList(BaseModel):
    """Schema for list of users."""
    users: List[User]
    total: int
    page: int
    per_page: int
    total_pages: int


# Authentication schemas
class Token(BaseModel):
    """Schema for JWT token response."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int


class TokenData(BaseModel):
    """Schema for token data."""
    sub: Optional[str] = None
    scopes: List[str] = []


class Login(BaseModel):
    """Schema for user login."""
    username: str = Field(..., description="Username or email")
    password: str = Field(..., description="User password")


class LoginResponse(BaseModel):
    """Schema for login response."""
    user: User
    token: Token


class RefreshToken(BaseModel):
    """Schema for refresh token request."""
    refresh_token: str = Field(..., description="Refresh token")


class PasswordReset(BaseModel):
    """Schema for password reset request."""
    email: EmailStr = Field(..., description="User email address")


class PasswordResetConfirm(BaseModel):
    """Schema for password reset confirmation."""
    token: str = Field(..., description="Password reset token")
    new_password: str = Field(..., min_length=8, description="New password")

    @validator("new_password")
    def validate_password(cls, v):
        """Validate password strength."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class EmailVerification(BaseModel):
    """Schema for email verification."""
    token: str = Field(..., description="Email verification token")


# Team schemas
class TeamMemberBase(BaseModel):
    """Base team member schema."""
    user_id: str
    role: str = Field("member", description="Team member role")
    permissions: Optional[List[str]] = Field(None, description="Additional permissions")


class TeamMemberCreate(TeamMemberBase):
    """Schema for adding team member."""
    pass


class TeamMemberUpdate(BaseModel):
    """Schema for updating team member."""
    role: Optional[str] = Field(None, description="Team member role")
    permissions: Optional[List[str]] = Field(None, description="Additional permissions")
    is_active: Optional[bool] = Field(None, description="Whether membership is active")


class TeamMember(TeamMemberBase):
    """Schema for team member response."""
    id: str
    team_id: str
    is_active: bool
    joined_at: Optional[datetime] = None
    created_at: datetime
    user: UserPublic

    class Config:
        from_attributes = True


class TeamBase(BaseModel):
    """Base team schema."""
    name: str = Field(..., min_length=1, max_length=100, description="Team name")
    slug: Optional[str] = Field(None, description="Team slug")
    description: Optional[str] = Field(None, description="Team description")
    avatar_url: Optional[str] = Field(None, description="URL to team avatar")
    is_active: bool = Field(True, description="Whether the team is active")


class TeamCreate(TeamBase):
    """Schema for creating a new team."""
    pass


class TeamUpdate(BaseModel):
    """Schema for updating a team."""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Team name")
    description: Optional[str] = Field(None, description="Team description")
    avatar_url: Optional[str] = Field(None, description="URL to team avatar")
    is_active: Optional[bool] = Field(None, description="Whether the team is active")
    settings: Optional[dict] = Field(None, description="Team settings")


class Team(TeamBase):
    """Schema for team response."""
    id: str
    owner_id: str
    settings: Optional[dict] = None
    created_at: datetime
    updated_at: datetime
    owner: UserPublic
    members: List[TeamMember] = []

    class Config:
        from_attributes = True


class TeamList(BaseModel):
    """Schema for list of teams."""
    teams: List[Team]
    total: int
    page: int
    per_page: int
    total_pages: int


# API Key schemas
class APIKeyBase(BaseModel):
    """Base API key schema."""
    name: str = Field(..., min_length=1, max_length=100, description="API key name")
    permissions: Optional[List[str]] = Field(None, description="API key permissions")
    expires_at: Optional[datetime] = Field(None, description="API key expiration time")


class APIKeyCreate(APIKeyBase):
    """Schema for creating a new API key."""
    pass


class APIKeyUpdate(BaseModel):
    """Schema for updating an API key."""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="API key name")
    permissions: Optional[List[str]] = Field(None, description="API key permissions")
    is_active: Optional[bool] = Field(None, description="Whether the API key is active")
    expires_at: Optional[datetime] = Field(None, description="API key expiration time")


class APIKey(APIKeyBase):
    """Schema for API key response."""
    id: str
    user_id: str
    prefix: str
    is_active: bool
    last_used_at: Optional[datetime] = None
    created_at: datetime
    created_by: str

    class Config:
        from_attributes = True


class APIKeyCreateResponse(BaseModel):
    """Schema for API key creation response (includes the actual key)."""
    api_key: APIKey
    key: str = Field(..., description="The actual API key (shown only once)")


class APIKeyList(BaseModel):
    """Schema for list of API keys."""
    api_keys: List[APIKey]
    total: int
    page: int
    per_page: int
    total_pages: int


# Session schemas
class Session(BaseModel):
    """Schema for user session."""
    id: str
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    is_active: bool
    expires_at: datetime
    created_at: datetime
    last_accessed_at: datetime

    class Config:
        from_attributes = True


class SessionList(BaseModel):
    """Schema for list of sessions."""
    sessions: List[Session]
    total: int
    page: int
    per_page: int
    total_pages: int