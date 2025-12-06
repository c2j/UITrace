"""Script schemas for API validation and serialization."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, validator


class ScriptBase(BaseModel):
    """Base script schema."""
    name: str = Field(..., min_length=1, max_length=255, description="Script name")
    slug: Optional[str] = Field(None, description="Script slug")
    description: Optional[str] = Field(None, description="Script description")
    tags: Optional[List[str]] = Field(None, description="Script tags")
    language: str = Field("python", description="Script language")
    framework: Optional[str] = Field(None, description="Test framework")
    is_public: bool = Field(False, description="Whether the script is public")
    is_template: bool = Field(False, description="Whether this is a template script")
    timeout_seconds: int = Field(300, description="Script timeout in seconds")
    retry_count: int = Field(0, description="Number of retries")
    default_browser: str = Field("chrome", description="Default browser for execution")
    execution_config: Optional[dict] = Field(None, description="Execution configuration")


class ScriptCreate(ScriptBase):
    """Schema for creating a new script."""
    project_id: str = Field(..., description="Project ID")
    content: dict = Field(..., description="Script content (JSON)")
    default_environment_id: Optional[str] = Field(None, description="Default environment ID")


class ScriptUpdate(BaseModel):
    """Schema for updating a script."""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Script name")
    description: Optional[str] = Field(None, description="Script description")
    tags: Optional[List[str]] = Field(None, description="Script tags")
    content: Optional[dict] = Field(None, description="Script content (JSON)")
    status: Optional[str] = Field(None, description="Script status")
    is_public: Optional[bool] = Field(None, description="Whether the script is public")
    is_template: Optional[bool] = Field(None, description="Whether this is a template script")
    timeout_seconds: Optional[int] = Field(None, description="Script timeout in seconds")
    retry_count: Optional[int] = Field(None, description="Number of retries")
    default_browser: Optional[str] = Field(None, description="Default browser for execution")
    default_environment_id: Optional[str] = Field(None, description="Default environment ID")
    execution_config: Optional[dict] = Field(None, description="Execution configuration")


class Script(ScriptBase):
    """Schema for script response."""
    id: str
    project_id: str
    version: int
    status: str
    is_locked: bool
    locked_by: Optional[str] = None
    locked_at: Optional[datetime] = None
    execution_count: int
    last_executed_at: Optional[datetime] = None
    success_rate: float
    created_at: datetime
    updated_at: datetime
    archived_at: Optional[datetime] = None
    created_by: str
    updated_by: Optional[str] = None

    class Config:
        from_attributes = True


class ScriptList(BaseModel):
    """Schema for list of scripts."""
    scripts: List[Script]
    total: int
    page: int
    per_page: int
    total_pages: int


class ScriptDetail(Script):
    """Detailed script schema with content."""
    content: dict


class ScriptLock(BaseModel):
    """Schema for script lock operations."""
    is_locked: bool = Field(..., description="Lock status")
    locked_by: Optional[str] = Field(None, description="User ID who locked the script")
    locked_at: Optional[datetime] = Field(None, description="Lock timestamp")


# Script Version schemas
class ScriptVersionBase(BaseModel):
    """Base script version schema."""
    version: int = Field(..., description="Version number")
    change_description: Optional[str] = Field(None, description="Change description")


class ScriptVersionCreate(ScriptVersionBase):
    """Schema for creating a new script version."""
    script_id: str = Field(..., description="Script ID")
    content: dict = Field(..., description="Script content (JSON)")


class ScriptVersion(ScriptVersionBase):
    """Schema for script version response."""
    id: str
    script_id: str
    content: dict
    content_diff: Optional[dict] = None
    checksum: str
    size_bytes: int
    created_at: datetime
    created_by: str

    class Config:
        from_attributes = True


class ScriptVersionList(BaseModel):
    """Schema for list of script versions."""
    versions: List[ScriptVersion]
    total: int
    page: int
    per_page: int
    total_pages: int


# Script Schedule schemas
class ScriptScheduleBase(BaseModel):
    """Base script schedule schema."""
    name: str = Field(..., min_length=1, max_length=255, description="Schedule name")
    description: Optional[str] = Field(None, description="Schedule description")
    cron_expression: str = Field(..., description="Cron expression")
    timezone: str = Field("UTC", description="Timezone")
    is_active: bool = Field(True, description="Whether the schedule is active")
    browser_type: str = Field("chrome", description="Browser type")
    execution_config: Optional[dict] = Field(None, description="Execution configuration")
    notify_on_success: bool = Field(False, description="Notify on success")
    notify_on_failure: bool = Field(True, description="Notify on failure")
    notification_emails: Optional[List[str]] = Field(None, description="Notification emails")


class ScriptScheduleCreate(ScriptScheduleBase):
    """Schema for creating a new script schedule."""
    script_id: str = Field(..., description="Script ID")
    environment_id: Optional[str] = Field(None, description="Environment ID")


class ScriptScheduleUpdate(BaseModel):
    """Schema for updating a script schedule."""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Schedule name")
    description: Optional[str] = Field(None, description="Schedule description")
    cron_expression: Optional[str] = Field(None, description="Cron expression")
    timezone: Optional[str] = Field(None, description="Timezone")
    is_active: Optional[bool] = Field(None, description="Whether the schedule is active")
    environment_id: Optional[str] = Field(None, description="Environment ID")
    browser_type: Optional[str] = Field(None, description="Browser type")
    execution_config: Optional[dict] = Field(None, description="Execution configuration")
    notify_on_success: Optional[bool] = Field(None, description="Notify on success")
    notify_on_failure: Optional[bool] = Field(None, description="Notify on failure")
    notification_emails: Optional[List[str]] = Field(None, description="Notification emails")


class ScriptSchedule(ScriptScheduleBase):
    """Schema for script schedule response."""
    id: str
    script_id: str
    environment_id: Optional[str] = None
    next_run_at: Optional[datetime] = None
    last_run_at: Optional[datetime] = None
    total_runs: int
    successful_runs: int
    failed_runs: int
    created_at: datetime
    updated_at: datetime
    created_by: str
    updated_by: Optional[str] = None

    class Config:
        from_attributes = True


class ScriptScheduleList(BaseModel):
    """Schema for list of script schedules."""
    schedules: List[ScriptSchedule]
    total: int
    page: int
    per_page: int
    total_pages: int


# Visual Baseline schemas
class VisualBaselineBase(BaseModel):
    """Base visual baseline schema."""
    name: str = Field(..., min_length=1, max_length=255, description="Baseline name")
    step_identifier: str = Field(..., description="Step identifier")
    description: Optional[str] = Field(None, description="Baseline description")
    similarity_threshold: float = Field(0.98, description="Similarity threshold (0-1)")
    comparison_mode: str = Field("pixel", description="Comparison mode")
    ignore_areas: Optional[List[dict]] = Field(None, description="Areas to ignore")
    browser_type: str = Field(..., description="Browser type")
    browser_version: Optional[str] = Field(None, description="Browser version")
    viewport_width: int = Field(..., description="Viewport width")
    viewport_height: int = Field(..., description="Viewport height")
    device_pixel_ratio: float = Field(1.0, description="Device pixel ratio")


class VisualBaselineCreate(VisualBaselineBase):
    """Schema for creating a new visual baseline."""
    script_id: str = Field(..., description="Script ID")
    image_path: str = Field(..., description="Baseline image path")
    thumbnail_path: Optional[str] = Field(None, description="Thumbnail image path")


class VisualBaselineUpdate(BaseModel):
    """Schema for updating a visual baseline."""
    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Baseline name")
    description: Optional[str] = Field(None, description="Baseline description")
    similarity_threshold: Optional[float] = Field(None, description="Similarity threshold (0-1)")
    comparison_mode: Optional[str] = Field(None, description="Comparison mode")
    ignore_areas: Optional[List[dict]] = Field(None, description="Areas to ignore")
    is_active: Optional[bool] = Field(None, description="Whether baseline is active")


class VisualBaseline(VisualBaselineBase):
    """Schema for visual baseline response."""
    id: str
    script_id: str
    image_path: str
    thumbnail_path: Optional[str] = None
    is_active: bool
    is_stable: bool
    comparison_count: int
    last_compared_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    created_by: str
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class VisualBaselineList(BaseModel):
    """Schema for list of visual baselines."""
    baselines: List[VisualBaseline]
    total: int
    page: int
    per_page: int
    total_pages: int


class VisualBaselineApprove(BaseModel):
    """Schema for approving a visual baseline."""
    is_approved: bool = Field(..., description="Approval status")
    notes: Optional[str] = Field(None, description="Approval notes")


# Visual Comparison schemas
class VisualComparisonBase(BaseModel):
    """Base visual comparison schema."""
    similarity_score: float = Field(..., description="Similarity score (0-1)")
    passed_threshold: bool = Field(..., description="Whether passed threshold")
    status: str = Field("pending", description="Comparison status")
    mismatch_percentage: float = Field(0.0, description="Mismatch percentage")
    comparison_algorithm: str = Field("pixel", description="Comparison algorithm")
    pixel_count: int = Field(..., description="Total pixel count")
    diff_pixel_count: int = Field(0, description="Different pixel count")


class VisualComparisonCreate(VisualComparisonBase):
    """Schema for creating a new visual comparison."""
    baseline_id: str = Field(..., description="Baseline ID")
    execution_id: str = Field(..., description="Execution ID")
    step_id: Optional[str] = Field(None, description="Step ID")
    current_image_path: str = Field(..., description="Current image path")
    diff_image_path: Optional[str] = Field(None, description="Diff image path")
    thumbnail_path: Optional[str] = Field(None, description="Thumbnail path")
    comparison_time_ms: int = Field(..., description="Comparison time in ms")


class VisualComparisonUpdate(BaseModel):
    """Schema for updating a visual comparison."""
    reviewed: bool = Field(False, description="Whether reviewed")
    approved: Optional[bool] = Field(None, description="Whether approved")
    notes: Optional[str] = Field(None, description="Review notes")


class VisualComparison(VisualComparisonBase):
    """Schema for visual comparison response."""
    id: str
    baseline_id: str
    execution_id: str
    step_id: Optional[str] = None
    current_image_path: str
    diff_image_path: Optional[str] = None
    thumbnail_path: Optional[str] = None
    comparison_time_ms: int
    reviewed: bool
    approved: Optional[bool] = None
    notes: Optional[str] = None
    created_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None

    class Config:
        from_attributes = True


class VisualComparisonList(BaseModel):
    """Schema for list of visual comparisons."""
    comparisons: List[VisualComparison]
    total: int
    page: int
    per_page: int
    total_pages: int