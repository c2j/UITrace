"""
Project and script models
"""

from sqlalchemy import Column, String, Boolean, DateTime, Enum, Text, Integer, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid
import enum

from app.db import Base


class ScriptStatus(enum.Enum):
    """Script status enumeration"""
    DRAFT = "draft"
    READY = "ready"
    ARCHIVED = "archived"


class ExecutionStatus(enum.Enum):
    """Execution status enumeration"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class BrowserType(enum.Enum):
    """Browser type enumeration"""
    CHROME = "chrome"
    FIREFOX = "firefox"
    EDGE = "edge"
    SAFARI = "safari"


class ExecutionMode(enum.Enum):
    """Execution mode enumeration"""
    SEQUENTIAL = "sequential"
    PARALLEL = "parallel"
    DATA_DRIVEN = "data_driven"


class CaseStatus(enum.Enum):
    """Test case status enumeration"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class StepType(enum.Enum):
    """Step type enumeration"""
    NAVIGATE = "navigate"
    CLICK = "click"
    TYPE = "type"
    ASSERT_TEXT = "assert_text"
    ASSERT_URL = "assert_url"
    SCREENSHOT = "screenshot"
    WAIT = "wait"


class StepStatus(enum.Enum):
    """Step status enumeration"""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class ComparisonStatus(enum.Enum):
    """Visual comparison status enumeration"""
    PENDING = "pending"
    PASSED = "passed"
    FAILED = "failed"
    ERROR = "error"


class DataFileType(enum.Enum):
    """Data file type enumeration"""
    CSV = "csv"
    EXCEL = "excel"


class Project(Base):
    """Project model"""
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    team_id = Column(UUID(as_uuid=True), ForeignKey("teams.id"), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    data_retention_months = Column(Integer, default=12, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<Project(id={self.id}, name='{self.name}')>"


class TestScript(Base):
    """Test script model"""
    __tablename__ = "test_scripts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    script_content = Column(JSON, nullable=False)  # JSON structure with steps and selectors
    version = Column(Integer, nullable=False, default=1)
    status = Column(Enum(ScriptStatus), nullable=False, default=ScriptStatus.DRAFT)
    locked_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    locked_at = Column(DateTime(timezone=True), nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    def __repr__(self):
        return f"<TestScript(id={self.id}, name='{self.name}', version={self.version})>"


class ScriptVersion(Base):
    """Script version history model"""
    __tablename__ = "script_versions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    script_id = Column(UUID(as_uuid=True), ForeignKey("test_scripts.id"), nullable=False)
    version = Column(Integer, nullable=False)
    script_content = Column(JSON, nullable=False)
    change_description = Column(Text, nullable=True)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<ScriptVersion(id={self.id}, script_id={self.script_id}, version={self.version})>"


class TestDataFile(Base):
    """Test data file model"""
    __tablename__ = "test_data_files"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    file_path = Column(String(500), nullable=False)
    file_type = Column(Enum(DataFileType), nullable=False)
    file_size = Column(Integer, nullable=False)
    column_headers = Column(JSON, nullable=True)  # JSON array of column names and types
    row_count = Column(Integer, nullable=False)
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<TestDataFile(id={self.id}, name='{self.name}', type={self.file_type})>"


class TestDataMapping(Base):
    """Test data mapping model"""
    __tablename__ = "test_data_mappings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    script_id = Column(UUID(as_uuid=True), ForeignKey("test_scripts.id"), nullable=False)
    data_file_id = Column(UUID(as_uuid=True), ForeignKey("test_data_files.id"), nullable=False)
    variable_mappings = Column(JSON, nullable=False)  # Map script variables to data columns
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<TestDataMapping(id={self.id}, script_id={self.script_id}, data_file_id={self.data_file_id})>"


class TestExecution(Base):
    """Test execution model"""
    __tablename__ = "test_executions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    script_id = Column(UUID(as_uuid=True), ForeignKey("test_scripts.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=False)
    execution_name = Column(String(100), nullable=True)
    browser_type = Column(Enum(BrowserType), nullable=False)
    execution_mode = Column(Enum(ExecutionMode), nullable=False, default=ExecutionMode.SEQUENTIAL)
    status = Column(Enum(ExecutionStatus), nullable=False, default=ExecutionStatus.PENDING)
    started_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    total_duration_ms = Column(Integer, nullable=True)
    total_steps = Column(Integer, nullable=True)
    successful_steps = Column(Integer, nullable=True)
    failed_steps = Column(Integer, nullable=True)

    def __repr__(self):
        return f"<TestExecution(id={self.id}, script_id={self.script_id}, status={self.status})>"


class TestCase(Base):
    """Test case model"""
    __tablename__ = "test_cases"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    execution_id = Column(UUID(as_uuid=True), ForeignKey("test_executions.id"), nullable=False)
    data_row_index = Column(Integer, nullable=True)  # For data-driven testing (0-based)
    status = Column(Enum(CaseStatus), nullable=False, default=CaseStatus.PENDING)
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_ms = Column(Integer, nullable=True)

    def __repr__(self):
        return f"<TestCase(id={self.id}, execution_id={self.execution_id}, status={self.status})>"


class TestStep(Base):
    """Test step model"""
    __tablename__ = "test_steps"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    test_case_id = Column(UUID(as_uuid=True), ForeignKey("test_cases.id"), nullable=False)
    step_index = Column(Integer, nullable=False)  # Order within the test case
    step_type = Column(Enum(StepType), nullable=False)
    element_selectors = Column(JSON, nullable=False)  # Array of selector strategies
    action_data = Column(JSON, nullable=True)  # Input values, URLs, etc.
    timeout_ms = Column(Integer, default=5000, nullable=False)
    status = Column(Enum(StepStatus), nullable=False, default=StepStatus.PENDING)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    duration_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    screenshot_before_path = Column(String(500), nullable=True)
    screenshot_after_path = Column(String(500), nullable=True)

    def __repr__(self):
        return f"<TestStep(id={self.id}, test_case_id={self.test_case_id}, step_index={self.step_index})>"


class VisualBaseline(Base):
    """Visual baseline model"""
    __tablename__ = "visual_baselines"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    script_id = Column(UUID(as_uuid=True), ForeignKey("test_scripts.id"), nullable=False)
    step_index = Column(Integer, nullable=False)
    baseline_name = Column(String(100), nullable=True)
    screenshot_path = Column(String(500), nullable=False)
    similarity_threshold = Column(Integer, default=98, nullable=False)  # 98% threshold
    created_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<VisualBaseline(id={self.id}, script_id={self.script_id}, step_index={self.step_index})>"


class VisualComparison(Base):
    """Visual comparison model"""
    __tablename__ = "visual_comparisons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    baseline_id = Column(UUID(as_uuid=True), ForeignKey("visual_baselines.id"), nullable=False)
    test_step_id = Column(UUID(as_uuid=True), ForeignKey("test_steps.id"), nullable=False)
    current_screenshot_path = Column(String(500), nullable=False)
    similarity_score = Column(Integer, nullable=False)  # 0-10000 (represents 0.0000 to 1.0000)
    difference_percentage = Column(Integer, nullable=False)  # Percentage difference
    comparison_status = Column(Enum(ComparisonStatus), nullable=False, default=ComparisonStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<VisualComparison(id={self.id}, baseline_id={self.baseline_id}, test_step_id={self.test_step_id})>"


class AuditAction(enum.Enum):
    """Audit action enumeration"""
    CREATE = "create"
    READ = "read"
    UPDATE = "update"
    DELETE = "delete"
    EXECUTE = "execute"
    DOWNLOAD = "download"
    UPLOAD = "upload"


class AuditLog(Base):
    """Audit log model"""
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)
    action = Column(Enum(AuditAction), nullable=False)
    entity_type = Column(String(50), nullable=False)  # 'script', 'project', 'user', etc.
    entity_id = Column(UUID(as_uuid=True), nullable=True)
    old_values = Column(JSON, nullable=True)  # Previous state (for updates)
    new_values = Column(JSON, nullable=True)  # New state (for creates/updates)
    ip_address = Column(String(45), nullable=True)  # IPv6 support
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    def __repr__(self):
        return f"<AuditLog(id={self.id}, user_id={self.user_id}, action={self.action}, entity_type={self.entity_type})>"