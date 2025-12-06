"""Authentication schemas for API validation and serialization."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, validator


class OAuthProviderBase(BaseModel):
    """Base OAuth provider schema."""
    name: str = Field(..., description="Provider name")
    display_name: str = Field(..., description="Provider display name")
    client_id: Optional[str] = Field(None, description="OAuth client ID")
    client_secret: Optional[str] = Field(None, description="OAuth client secret")
    authorization_url: str = Field(..., description="Authorization URL")
    token_url: str = Field(..., description="Token URL")
    user_info_url: str = Field(..., description="User info URL")
    scope: List[str] = Field(..., description="OAuth scopes")
    is_active: bool = Field(True, description="Whether provider is active")


class OAuthProviderCreate(OAuthProviderBase):
    """Schema for creating OAuth provider."""
    pass


class OAuthProviderUpdate(BaseModel):
    """Schema for updating OAuth provider."""
    name: Optional[str] = Field(None, description="Provider name")
    display_name: Optional[str] = Field(None, description="Provider display name")
    client_id: Optional[str] = Field(None, description="OAuth client ID")
    client_secret: Optional[str] = Field(None, description="OAuth client secret")
    authorization_url: Optional[str] = Field(None, description="Authorization URL")
    token_url: Optional[str] = Field(None, description="Token URL")
    user_info_url: Optional[str] = Field(None, description="User info URL")
    scope: Optional[List[str]] = Field(None, description="OAuth scopes")
    is_active: Optional[bool] = Field(None, description="Whether provider is active")


class OAuthProvider(OAuthProviderBase):
    """Schema for OAuth provider response."""
    id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OAuthUrl(BaseModel):
    """Schema for OAuth authorization URL."""
    authorization_url: str = Field(..., description="OAuth authorization URL")
    state: str = Field(..., description="OAuth state parameter")


class OAuthCallback(BaseModel):
    """Schema for OAuth callback."""
    code: Optional[str] = Field(None, description="Authorization code")
    state: Optional[str] = Field(None, description="OAuth state")
    error: Optional[str] = Field(None, description="OAuth error")


class OAuthUserInfo(BaseModel):
    """Schema for OAuth user info."""
    id: str = Field(..., description="User ID from provider")
    email: EmailStr = Field(..., description="User email")
    name: Optional[str] = Field(None, description="User name")
    avatar_url: Optional[str] = Field(None, description="Avatar URL")
    provider: str = Field(..., description="OAuth provider")


# Permission schemas
class Permission(BaseModel):
    """Schema for permission."""
    id: str
    name: str
    description: str
    resource: str
    action: str
    scope: str

    class Config:
        from_attributes = True


class RoleBase(BaseModel):
    """Base role schema."""
    name: str = Field(..., description="Role name")
    display_name: str = Field(..., description="Role display name")
    description: Optional[str] = Field(None, description="Role description")
    is_system: bool = Field(False, description="Whether this is a system role")
    is_active: bool = Field(True, description="Whether role is active")


class RoleCreate(RoleBase):
    """Schema for creating a new role."""
    permissions: List[str] = Field(..., description="Permission IDs")


class RoleUpdate(BaseModel):
    """Schema for updating a role."""
    name: Optional[str] = Field(None, description="Role name")
    display_name: Optional[str] = Field(None, description="Role display name")
    description: Optional[str] = Field(None, description="Role description")
    is_active: Optional[bool] = Field(None, description="Whether role is active")
    permissions: Optional[List[str]] = Field(None, description="Permission IDs")


class Role(RoleBase):
    """Schema for role response."""
    id: str
    permissions: List[Permission]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RoleList(BaseModel):
    """Schema for list of roles."""
    roles: List[Role]
    total: int
    page: int
    per_page: int
    total_pages: int


# Session schemas
class SessionCreate(BaseModel):
    """Schema for creating a session."""
    user_id: str = Field(..., description="User ID")
    ip_address: Optional[str] = Field(None, description="IP address")
    user_agent: Optional[str] = Field(None, description="User agent")
    expires_at: datetime = Field(..., description="Session expiration")


class SessionUpdate(BaseModel):
    """Schema for updating a session."""
    is_active: Optional[bool] = Field(None, description="Whether session is active")
    expires_at: Optional[datetime] = Field(None, description="Session expiration")


# Audit Log schemas
class AuditLogBase(BaseModel):
    """Base audit log schema."""
    action: str = Field(..., description="Action performed")
    entity_type: str = Field(..., description="Entity type")
    entity_id: Optional[str] = Field(None, description="Entity ID")
    old_values: Optional[dict] = Field(None, description="Previous values")
    new_values: Optional[dict] = Field(None, description="New values")
    ip_address: Optional[str] = Field(None, description="IP address")
    user_agent: Optional[str] = Field(None, description="User agent")


class AuditLogCreate(AuditLogBase):
    """Schema for creating an audit log."""
    user_id: Optional[str] = Field(None, description="User ID")
    project_id: Optional[str] = Field(None, description="Project ID")


class AuditLog(AuditLogBase):
    """Schema for audit log response."""
    id: str
    user_id: Optional[str] = None
    project_id: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogList(BaseModel):
    """Schema for list of audit logs."""
    logs: List[AuditLog]
    total: int
    page: int
    per_page: int
    total_pages: int


# Two-Factor Authentication schemas
class TFASetup(BaseModel):
    """Schema for TFA setup."""
    secret: str = Field(..., description="TFA secret")
    qr_code: str = Field(..., description="QR code for authenticator app")
    backup_codes: List[str] = Field(..., description="Backup codes")


class TFAVerify(BaseModel):
    """Schema for TFA verification."""
    code: str = Field(..., min_length=6, max_length=6, description="TFA code")


class TFAEnable(BaseModel):
    """Schema for enabling TFA."""
    code: str = Field(..., min_length=6, max_length=6, description="TFA code")


class TFADisable(BaseModel):
    """Schema for disabling TFA."""
    password: str = Field(..., description="User password")


# Login Attempt schemas
class LoginAttempt(BaseModel):
    """Schema for login attempt tracking."""
    ip_address: str = Field(..., description="IP address")
    email: Optional[str] = Field(None, description="Email attempted")
    username: Optional[str] = Field(None, description="Username attempted")
    success: bool = Field(..., description="Whether login was successful")
    failure_reason: Optional[str] = Field(None, description="Failure reason")
    user_agent: Optional[str] = Field(None, description="User agent")

    class Config:
        from_attributes = True


class SecuritySettings(BaseModel):
    """Schema for security settings."""
    password_min_length: int = Field(8, description="Minimum password length")
    password_require_uppercase: bool = Field(True, description="Require uppercase")
    password_require_lowercase: bool = Field(True, description="Require lowercase")
    password_require_digit: bool = Field(True, description="Require digit")
    password_require_special: bool = Field(False, description="Require special character")
    session_timeout_minutes: int = Field(1440, description="Session timeout in minutes")
    max_login_attempts: int = Field(5, description="Maximum login attempts")
    lockout_duration_minutes: int = Field(30, description="Account lockout duration")
    require_tfa: bool = Field(False, description="Require two-factor authentication")
    allowed_ip_ranges: List[str] = Field([], description="Allowed IP ranges")
    blocked_ip_ranges: List[str] = Field([], description="Blocked IP ranges")

    class Config:
        from_attributes = True