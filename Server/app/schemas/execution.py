"""Execution schemas for API validation and serialization."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, validator


class ExecutionBase(BaseModel):
    """Base execution schema."""
    name: Optional[str] = Field(None, description="Execution name")
    description: Optional[str] = Field(None, description="Execution description")
    browser_type: str = Field("chrome", description="Browser type")
    browser_version: Optional[str] = Field(None, description="Browser version")
    execution_mode: str = Field("sequential", description="Execution mode")
    execution_config: Optional[dict] = Field(None, description="Execution configuration")
    timeout_seconds: int = Field(300, description="Timeout in seconds")


class ExecutionCreate(ExecutionBase):
    """Schema for creating a new execution."""
    project_id: str = Field(..., description="Project ID")
    script_id: str = Field(..., description="Script ID")
    environment_id: Optional[str] = Field(None, description="Environment ID")
    data_file_id: Optional[str] = Field(None, description="Data file ID")
    data_rows: Optional[List[int]] = Field(None, description="Specific data rows to execute")


class ExecutionUpdate(BaseModel):
    """Schema for updating an execution."""
    status: Optional[str] = Field(None, description="Execution status")
    result_status: Optional[str] = Field(None, description="Result status")
    error_message: Optional[str] = Field(None, description="Error message")
    error_stack_trace: Optional[str] = Field(None, description="Error stack trace")
    progress_percentage: Optional[float] = Field(None, description="Progress percentage")
    current_step: Optional[int] = Field(None, description="Current step number")


class Execution(ExecutionBase):
    """Schema for execution response."""
    id: str
    project_id: str
    script_id: str
    environment_id: Optional[str] = None
    data_file_id: Optional[str] = None
    data_rows: Optional[List[int]] = None
    status: str
    progress_percentage: float
    current_step: Optional[int] = None
    total_steps: Optional[int] = None
    result_status: Optional[str] = None
    exit_code: Optional[int] = None
    error_message: Optional[str] = None
    error_stack_trace: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    total_test_cases: int
    passed_test_cases: int
    failed_test_cases: int
    skipped_test_cases: int
    total_steps: int
    passed_steps: int
    failed_steps: int
    skipped_steps: int
    screenshots_taken: int
    visual_comparisons: int
    visual_passed: int
    visual_failed: int
    worker_id: Optional[str] = None
    session_id: Optional[str] = None
    retry_count: int
    is_retry: bool
    original_execution_id: Optional[str] = None
    trigger_type: str
    triggered_by: Optional[str] = None
    schedule_id: Optional[str] = None
    webhook_id: Optional[str] = None
    artifact_paths: Optional[List[str]] = None
    report_path: Optional[str] = None
    video_path: Optional[str] = None
    logs_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExecutionList(BaseModel):
    """Schema for list of executions."""
    executions: List[Execution]
    total: int
    page: int
    per_page: int
    total_pages: int


class ExecutionDetail(Execution):
    """Detailed execution schema with related data."""
    project: Optional[dict] = None
    script: Optional[dict] = None
    environment: Optional[dict] = None
    test_cases: List["TestCase"] = []
    artifacts: List["ExecutionArtifact"] = []


# Test Case schemas
class TestCaseBase(BaseModel):
    """Base test case schema."""
    name: Optional[str] = Field(None, description="Test case name")
    description: Optional[str] = Field(None, description="Test case description")
    test_index: int = Field(..., description="Test case index")
    data_row_index: Optional[int] = Field(None, description="Data row index")
    test_data: Optional[dict] = Field(None, description="Test data")


class TestCaseCreate(TestCaseBase):
    """Schema for creating a new test case."""
    execution_id: str = Field(..., description="Execution ID")


class TestCaseUpdate(BaseModel):
    """Schema for updating a test case."""
    status: Optional[str] = Field(None, description="Test case status")
    result_status: Optional[str] = Field(None, description="Result status")
    error_message: Optional[str] = Field(None, description="Error message")
    error_stack_trace: Optional[str] = Field(None, description="Error stack trace")


class TestCase(TestCaseBase):
    """Schema for test case response."""
    id: str
    execution_id: str
    status: str
    result_status: Optional[str] = None
    error_message: Optional[str] = None
    error_stack_trace: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    total_steps: int
    passed_steps: int
    failed_steps: int
    skipped_steps: int
    screenshots_taken: int
    visual_comparisons: int
    visual_passed: int
    visual_failed: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TestCaseList(BaseModel):
    """Schema for list of test cases."""
    test_cases: List[TestCase]
    total: int
    page: int
    per_page: int
    total_pages: int


# Execution Step schemas
class ExecutionStepBase(BaseModel):
    """Base execution step schema."""
    step_index: int = Field(..., description="Step index")
    step_type: str = Field(..., description="Step type")
    description: Optional[str] = Field(None, description="Step description")
    target_element: Optional[dict] = Field(None, description="Target element")
    action_data: Optional[dict] = Field(None, description="Action data")
    expected_result: Optional[dict] = Field(None, description="Expected result")
    timeout_ms: int = Field(5000, description="Timeout in milliseconds")
    retry_count: int = Field(0, description="Retry count")


class ExecutionStepCreate(ExecutionStepBase):
    """Schema for creating a new execution step."""
    execution_id: str = Field(..., description="Execution ID")
    test_case_id: Optional[str] = Field(None, description="Test case ID")


class ExecutionStepUpdate(BaseModel):
    """Schema for updating an execution step."""
    status: Optional[str] = Field(None, description="Step status")
    result_status: Optional[str] = Field(None, description="Result status")
    error_message: Optional[str] = Field(None, description="Error message")
    error_stack_trace: Optional[str] = Field(None, description="Error stack trace")
    input_data: Optional[dict] = Field(None, description="Input data")
    output_data: Optional[dict] = Field(None, description="Output data")
    metadata: Optional[dict] = Field(None, description="Step metadata")


class ExecutionStep(ExecutionStepBase):
    """Schema for execution step response."""
    id: str
    execution_id: str
    test_case_id: Optional[str] = None
    status: str
    result_status: Optional[str] = None
    error_message: Optional[str] = None
    error_stack_trace: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None
    screenshot_before_path: Optional[str] = None
    screenshot_after_path: Optional[str] = None
    visual_comparison_id: Optional[str] = None
    input_data: Optional[dict] = None
    output_data: Optional[dict] = None
    metadata: Optional[dict] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ExecutionStepList(BaseModel):
    """Schema for list of execution steps."""
    steps: List[ExecutionStep]
    total: int
    page: int
    per_page: int
    total_pages: int


# Execution Artifact schemas
class ExecutionArtifactBase(BaseModel):
    """Base execution artifact schema."""
    name: str = Field(..., description="Artifact name")
    description: Optional[str] = Field(None, description="Artifact description")
    artifact_type: str = Field(..., description="Artifact type")
    mime_type: str = Field(..., description="MIME type")
    metadata: Optional[dict] = Field(None, description="Artifact metadata")
    is_public: bool = Field(False, description="Whether artifact is public")
    retention_days: Optional[int] = Field(None, description="Retention period in days")


class ExecutionArtifactCreate(ExecutionArtifactBase):
    """Schema for creating a new execution artifact."""
    execution_id: str = Field(..., description="Execution ID")
    test_case_id: Optional[str] = Field(None, description="Test case ID")
    step_id: Optional[str] = Field(None, description="Step ID")
    file_path: str = Field(..., description="File path")
    file_size: int = Field(..., description="File size in bytes")
    checksum: str = Field(..., description="File checksum")


class ExecutionArtifactUpdate(BaseModel):
    """Schema for updating an execution artifact."""
    name: Optional[str] = Field(None, description="Artifact name")
    description: Optional[str] = Field(None, description="Artifact description")
    is_public: Optional[bool] = Field(None, description="Whether artifact is public")
    retention_days: Optional[int] = Field(None, description="Retention period in days")
    metadata: Optional[dict] = Field(None, description="Artifact metadata")


class ExecutionArtifact(ExecutionArtifactBase):
    """Schema for execution artifact response."""
    id: str
    execution_id: str
    test_case_id: Optional[str] = None
    step_id: Optional[str] = None
    file_path: str
    file_size: int
    checksum: str
    created_at: datetime
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ExecutionArtifactList(BaseModel):
    """Schema for list of execution artifacts."""
    artifacts: List[ExecutionArtifact]
    total: int
    page: int
    per_page: int
    total_pages: int


class ExecutionArtifactUpload(BaseModel):
    """Schema for artifact upload response."""
    artifact: ExecutionArtifact
    upload_url: str = Field(..., description="Pre-signed upload URL")
    upload_id: str = Field(..., description="Upload ID")


# Execution Control schemas
class ExecutionControl(BaseModel):
    """Schema for execution control commands."""
    action: str = Field(..., description="Control action")
    parameters: Optional[dict] = Field(None, description="Action parameters")


class ExecutionStop(BaseModel):
    """Schema for stopping execution."""
    reason: Optional[str] = Field(None, description="Stop reason")


class ExecutionRetry(BaseModel):
    """Schema for retrying execution."""
    retry_failed_only: bool = Field(False, description="Retry only failed steps")
    retry_count: int = Field(1, description="Number of retries")


class ExecutionReport(BaseModel):
    """Schema for execution report request."""
    format: str = Field("html", description="Report format")
    include_screenshots: bool = Field(True, description="Include screenshots")
    include_steps: bool = Field(True, description="Include step details")
    include_artifacts: bool = Field(False, description="Include artifacts")


class ExecutionReportResponse(BaseModel):
    """Schema for execution report response."""
    report_url: str = Field(..., description="Report URL")
    report_path: str = Field(..., description="Report file path")
    expires_at: datetime = Field(..., description="Report expiration time")