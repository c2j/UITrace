"""Project schemas for API validation and serialization."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, validator


class ProjectBase(BaseModel):
    """Base project schema."""
    name: str = Field(..., min_length=1, max_length=100, description="Project name")
    slug: Optional[str] = Field(None, description="Project slug")
    description: Optional[str] = Field(None, description="Project description")
    avatar_url: Optional[str] = Field(None, description="URL to project avatar")
    is_active: bool = Field(True, description="Whether the project is active")
    is_public: bool = Field(False, description="Whether the project is public")
    data_retention_months: int = Field(12, description="Data retention period in months")
    settings: Optional[dict] = Field(None, description="Project settings")


class ProjectCreate(ProjectBase):
    """Schema for creating a new project."""
    team_id: Optional[str] = Field(None, description="Team ID (optional)")
    max_scripts: Optional[int] = Field(None, description="Maximum number of scripts")
    max_executions_per_day: Optional[int] = Field(None, description="Maximum executions per day")


class ProjectUpdate(BaseModel):
    """Schema for updating a project."""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Project name")
    description: Optional[str] = Field(None, description="Project description")
    avatar_url: Optional[str] = Field(None, description="URL to project avatar")
    is_active: Optional[bool] = Field(None, description="Whether the project is active")
    is_public: Optional[bool] = Field(None, description="Whether the project is public")
    data_retention_months: Optional[int] = Field(None, description="Data retention period in months")
    settings: Optional[dict] = Field(None, description="Project settings")
    max_scripts: Optional[int] = Field(None, description="Maximum number of scripts")
    max_executions_per_day: Optional[int] = Field(None, description="Maximum executions per day")


class Project(ProjectBase):
    """Schema for project response."""
    id: str
    owner_id: str
    team_id: Optional[str] = None
    max_scripts: Optional[int] = None
    max_executions_per_day: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    archived_at: Optional[datetime] = None
    owner: Optional[dict] = None
    team: Optional[dict] = None

    class Config:
        from_attributes = True


class ProjectList(BaseModel):
    """Schema for list of projects."""
    projects: List[Project]
    total: int
    page: int
    per_page: int
    total_pages: int


# Environment schemas
class EnvironmentBase(BaseModel):
    """Base environment schema."""
    name: str = Field(..., min_length=1, max_length=100, description="Environment name")
    slug: Optional[str] = Field(None, description="Environment slug")
    description: Optional[str] = Field(None, description="Environment description")
    base_url: Optional[str] = Field(None, description="Base URL for the environment")
    variables: Optional[dict] = Field(None, description="Environment variables")
    headers: Optional[dict] = Field(None, description="Default headers")
    environment_type: str = Field("testing", description="Environment type")
    is_default: bool = Field(False, description="Whether this is the default environment")
    is_active: bool = Field(True, description="Whether the environment is active")


class EnvironmentCreate(EnvironmentBase):
    """Schema for creating a new environment."""
    project_id: str = Field(..., description="Project ID")
    credentials: Optional[dict] = Field(None, description="Environment credentials (encrypted)")


class EnvironmentUpdate(BaseModel):
    """Schema for updating an environment."""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Environment name")
    description: Optional[str] = Field(None, description="Environment description")
    base_url: Optional[str] = Field(None, description="Base URL for the environment")
    variables: Optional[dict] = Field(None, description="Environment variables")
    headers: Optional[dict] = Field(None, description="Default headers")
    credentials: Optional[dict] = Field(None, description="Environment credentials (encrypted)")
    environment_type: Optional[str] = Field(None, description="Environment type")
    is_default: Optional[bool] = Field(None, description="Whether this is the default environment")
    is_active: Optional[bool] = Field(None, description="Whether the environment is active")


class Environment(EnvironmentBase):
    """Schema for environment response."""
    id: str
    project_id: str
    created_at: datetime
    updated_at: datetime
    created_by: str

    class Config:
        from_attributes = True


class EnvironmentList(BaseModel):
    """Schema for list of environments."""
    environments: List[Environment]
    total: int
    page: int
    per_page: int
    total_pages: int


# Data File schemas
class DataFileBase(BaseModel):
    """Base data file schema."""
    name: str = Field(..., min_length=1, max_length=255, description="File name")
    description: Optional[str] = Field(None, description="File description")
    file_type: str = Field(..., description="File type")
    mime_type: str = Field(..., description="MIME type")


class DataFileCreate(DataFileBase):
    """Schema for creating a new data file."""
    project_id: str = Field(..., description="Project ID")


class DataFileUpdate(BaseModel):
    """Schema for updating a data file."""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="File name")
    description: Optional[str] = Field(None, description="File description")
    is_active: Optional[bool] = Field(None, description="Whether the file is active")


class DataFile(DataFileBase):
    """Schema for data file response."""
    id: str
    project_id: str
    file_path: str
    file_size: int
    headers: Optional[List[dict]] = None
    row_count: Optional[int] = None
    column_count: Optional[int] = None
    checksum: str
    is_active: bool
    is_processed: bool
    created_at: datetime
    updated_at: datetime
    created_by: str

    class Config:
        from_attributes = True


class DataFileList(BaseModel):
    """Schema for list of data files."""
    data_files: List[DataFile]
    total: int
    page: int
    per_page: int
    total_pages: int


class DataFileUpload(BaseModel):
    """Schema for data file upload response."""
    data_file: DataFile
    upload_url: str = Field(..., description="Pre-signed upload URL")
    upload_id: str = Field(..., description="Upload ID")


# Webhook schemas
class WebhookBase(BaseModel):
    """Base webhook schema."""
    name: str = Field(..., min_length=1, max_length=100, description="Webhook name")
    url: str = Field(..., description="Webhook URL")
    description: Optional[str] = Field(None, description="Webhook description")
    events: List[str] = Field(..., description="Events to trigger webhook")
    secret: Optional[str] = Field(None, description="Webhook secret")
    headers: Optional[dict] = Field(None, description="Additional headers")
    is_active: bool = Field(True, description="Whether the webhook is active")
    retry_count: int = Field(3, description="Number of retries")
    timeout_seconds: int = Field(30, description="Request timeout in seconds")


class WebhookCreate(WebhookBase):
    """Schema for creating a new webhook."""
    project_id: str = Field(..., description="Project ID")


class WebhookUpdate(BaseModel):
    """Schema for updating a webhook."""
    name: Optional[str] = Field(None, min_length=1, max_length=100, description="Webhook name")
    url: Optional[str] = Field(None, description="Webhook URL")
    description: Optional[str] = Field(None, description="Webhook description")
    events: Optional[List[str]] = Field(None, description="Events to trigger webhook")
    secret: Optional[str] = Field(None, description="Webhook secret")
    headers: Optional[dict] = Field(None, description="Additional headers")
    is_active: Optional[bool] = Field(None, description="Whether the webhook is active")
    retry_count: Optional[int] = Field(None, description="Number of retries")
    timeout_seconds: Optional[int] = Field(None, description="Request timeout in seconds")


class Webhook(WebhookBase):
    """Schema for webhook response."""
    id: str
    project_id: str
    last_triggered_at: Optional[datetime] = None
    trigger_count: int
    failure_count: int
    created_at: datetime
    updated_at: datetime
    created_by: str

    class Config:
        from_attributes = True


class WebhookList(BaseModel):
    """Schema for list of webhooks."""
    webhooks: List[Webhook]
    total: int
    page: int
    per_page: int
    total_pages: int


class WebhookTest(BaseModel):
    """Schema for testing a webhook."""
    event: str = Field(..., description="Event type to test")
    data: Optional[dict] = Field(None, description="Test data payload")


class WebhookTestResult(BaseModel):
    """Schema for webhook test result."""
    success: bool
    status_code: Optional[int] = None
    response_body: Optional[str] = None
    error_message: Optional[str] = None
    duration_ms: int