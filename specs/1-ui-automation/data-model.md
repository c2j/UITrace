# Data Models: UI Automation Testing Platform

**Feature**: UI Automation Testing Platform
**Date**: 2025-11-30
**Purpose**: Define core data entities and relationships for UITrace platform

## Overview

The UITrace platform uses a dual-database approach:
- **Client (SQLite)**: Local caching, temporary execution data, screenshots
- **Server (PostgreSQL)**: Centralized user data, script management, collaboration features

## Core Entities

### User Management

#### User (Server)
```python
# Pydantic Model - Server API
class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: EmailStr
    full_name: Optional[str] = None
    role: UserRole = UserRole.TESTER

class UserResponse(BaseModel):
    id: UUID
    username: str
    email: EmailStr
    full_name: Optional[str]
    role: UserRole
    created_at: datetime
    last_login: Optional[datetime]
    is_active: bool
```

```sql
-- PostgreSQL Schema
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(100),
    role VARCHAR(20) NOT NULL DEFAULT 'tester',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    password_hash VARCHAR(255) NOT NULL
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

### Script Management

#### Script (Server)
```python
# Pydantic Model - Server API
class ScriptMetadata(BaseModel):
    id: UUID
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    version: str = Field(..., regex=r'^\d+\.\d+\.\d+$')
    author_id: UUID
    project_id: Optional[UUID] = None
    tags: List[str] = []
    created_at: datetime
    updated_at: datetime
    status: ScriptStatus = ScriptStatus.DRAFT

class ScriptContent(BaseModel):
    script_id: UUID
    content: str  # JSON string of test steps
    checksum: str  # SHA-256 for integrity
    content_type: str = "application/json"
    size_bytes: int
```

```sql
-- PostgreSQL Schema
CREATE TABLE scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    version VARCHAR(20) NOT NULL,
    author_id UUID NOT NULL REFERENCES users(id),
    project_id UUID REFERENCES projects(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'draft'
);

CREATE TABLE script_content (
    script_id UUID PRIMARY KEY REFERENCES scripts(id) ON DELETE CASCADE,
    content JSONB NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    content_type VARCHAR(100) DEFAULT 'application/json',
    size_bytes INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_scripts_name ON scripts(name);
CREATE INDEX idx_scripts_author ON scripts(author_id);
CREATE INDEX idx_scripts_project ON scripts(project_id);
CREATE INDEX idx_scripts_status ON scripts(status);
CREATE INDEX idx_script_content_checksum ON script_content(checksum);
```

#### Script (Client - SQLite)
```sql
-- SQLite Schema
CREATE TABLE local_scripts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT NOT NULL,
    server_id UUID, -- NULL for local-only scripts
    content TEXT NOT NULL, -- JSON
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_synced BOOLEAN DEFAULT false
);

CREATE TABLE local_screenshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id TEXT REFERENCES local_scripts(id),
    step_id INTEGER,
    screenshot_type TEXT NOT NULL, -- 'baseline', 'actual', 'diff'
    file_path TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Test Step Definition

#### TestStep (JSON Schema)
```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "step_id": {
      "type": "integer",
      "minimum": 1
    },
    "name": {
      "type": "string",
      "minLength": 1,
      "maxLength": 200
    },
    "action": {
      "type": "string",
      "enum": ["navigate", "click", "type", "clear", "select", "scroll", "wait", "assert_text", "assert_url", "assert_visible", "screenshot", "execute_script"]
    },
    "value": {
      "type": "string",
      "description": "Action parameter, supports data placeholders like ${username}"
    },
    "expected_value": {
      "type": "string",
      "description": "Expected result for assertions"
    },
    "timeout_seconds": {
      "type": "integer",
      "minimum": 1,
      "maximum": 300,
      "default": 10
    },
    "retry_count": {
      "type": "integer",
      "minimum": 0,
      "maximum": 10,
      "default": 3
    },
    "selectors": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "type": {
            "type": "string",
            "enum": ["id", "css", "xpath", "name", "class", "tag", "link_text", "partial_link_text"]
          },
          "value": {
            "type": "string",
            "minLength": 1
          },
          "priority": {
            "type": "integer",
            "minimum": 1
          }
        },
        "required": ["type", "value", "priority"]
      },
      "minItems": 1
    },
    "data_source": {
      "type": "string",
      "description": "External data file reference for data-driven testing"
    },
    "enabled": {
      "type": "boolean",
      "default": true
    }
  },
  "required": ["step_id", "name", "action", "selectors"],
  "additionalProperties": false
}
```

### Data Management

#### DataFile (Server)
```python
# Pydantic Model - Server API
class DataFileMetadata(BaseModel):
    id: UUID
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    file_type: str = Field(..., regex=r'^(csv|excel)$')
    columns: List[str] = []
    row_count: int
    file_size_bytes: int
    checksum: str
    uploaded_by: UUID
    created_at: datetime

class DataFilePreview(BaseModel):
    columns: List[str]
    sample_rows: List[Dict[str, str]]
    total_rows: int
```

```sql
-- PostgreSQL Schema
CREATE TABLE data_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    file_type VARCHAR(10) NOT NULL,
    columns JSONB NOT NULL,
    row_count INTEGER NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    checksum VARCHAR(64) NOT NULL,
    uploaded_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_data_files_name ON data_files(name);
CREATE INDEX idx_data_files_type ON data_files(file_type);
CREATE INDEX idx_data_files_uploaded_by ON data_files(uploaded_by);
```

#### DataFile (Client - SQLite)
```sql
-- SQLite Schema
CREATE TABLE local_data_files (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    columns TEXT, -- JSON array
    row_count INTEGER,
    checksum TEXT,
    server_id UUID, -- NULL for local-only files
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Test Execution Results

#### TestExecution (Server)
```python
# Pydantic Model - Server API
class TestExecution(BaseModel):
    id: UUID
    script_id: UUID
    execution_context: ExecutionContext
    status: ExecutionStatus
    started_at: datetime
    completed_at: Optional[datetime]
    total_duration_ms: Optional[int]
    steps_executed: int
    steps_passed: int
    steps_failed: int
    steps_skipped: int
    visual_difference_score: Optional[float]
    error_message: Optional[str]
    created_by: UUID

class ExecutionContext(BaseModel):
    environment: str  # 'development', 'staging', 'production'
    browser_type: str  # 'chrome', 'firefox', 'safari', 'edge'
    browser_version: str
    operating_system: str  # 'windows', 'macos', 'linux'
    resolution: str  # '1920x1080', etc.
    data_file_id: Optional[UUID]
```

```sql
-- PostgreSQL Schema
CREATE TABLE test_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID NOT NULL REFERENCES scripts(id),
    execution_context JSONB NOT NULL,
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    total_duration_ms INTEGER,
    steps_executed INTEGER NOT NULL DEFAULT 0,
    steps_passed INTEGER NOT NULL DEFAULT 0,
    steps_failed INTEGER NOT NULL DEFAULT 0,
    steps_skipped INTEGER NOT NULL DEFAULT 0,
    visual_difference_score NUMERIC(5,2),
    error_message TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_test_executions_script_id ON test_executions(script_id);
CREATE INDEX idx_test_executions_status ON test_executions(status);
CREATE INDEX idx_test_executions_created_by ON test_executions(created_by);
CREATE INDEX idx_test_executions_started_at ON test_executions(started_at);
```

#### TestStepResult (Server)
```python
# Pydantic Model - Server API
class TestStepResult(BaseModel):
    id: UUID
    execution_id: UUID
    step_id: int
    status: StepStatus
    started_at: datetime
    completed_at: Optional[datetime]
    duration_ms: Optional[int]
    used_selector: Optional[str]
    error_message: Optional[str]
    screenshot_baseline: Optional[str]
    screenshot_actual: Optional[str]
    screenshot_diff: Optional[str]
    visual_difference_percent: Optional[float]
```

```sql
-- PostgreSQL Schema
CREATE TABLE test_step_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES test_executions(id) ON DELETE CASCADE,
    step_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    used_selector TEXT,
    error_message TEXT,
    screenshot_baseline TEXT,
    screenshot_actual TEXT,
    screenshot_diff TEXT,
    visual_difference_percent NUMERIC(5,2)
);

CREATE INDEX idx_test_step_results_execution_id ON test_step_results(execution_id);
CREATE INDEX idx_test_step_results_status ON test_step_results(status);
```

### Project Management

#### Project (Server)
```python
# Pydantic Model - Server API
class Project(BaseModel):
    id: UUID
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    owner_id: UUID
    created_at: datetime
    updated_at: datetime
    is_active: bool = true
    settings: Dict[str, Any] = {}
```

```sql
-- PostgreSQL Schema
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    owner_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    settings JSONB DEFAULT '{}'
);

CREATE INDEX idx_projects_name ON projects(name);
CREATE INDEX idx_projects_owner_id ON projects(owner_id);
```

### Collaboration Features

#### ScriptLock (Server)
```python
# Pydantic Model - Server API
class ScriptLock(BaseModel):
    script_id: UUID
    locked_by: UUID
    locked_at: datetime
    expires_at: datetime
    lock_reason: Optional[str] = None
```

```sql
-- PostgreSQL Schema
CREATE TABLE script_locks (
    script_id UUID PRIMARY KEY REFERENCES scripts(id) ON DELETE CASCADE,
    locked_by UUID NOT NULL REFERENCES users(id),
    locked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    lock_reason TEXT
);

CREATE INDEX idx_script_locks_locked_by ON script_locks(locked_by);
CREATE INDEX idx_script_locks_expires_at ON script_locks(expires_at);
```

#### UserProjectRole (Server)
```python
# Pydantic Model - Server API
class UserRole(str, Enum):
    ADMIN = "admin"
    PROJECT_MANAGER = "project_manager"
    TESTER = "tester"
    VIEWER = "viewer"

class UserProjectRole(BaseModel):
    user_id: UUID
    project_id: UUID
    role: UserRole
    granted_by: UUID
    granted_at: datetime
```

```sql
-- PostgreSQL Schema
CREATE TABLE user_project_roles (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    granted_by UUID NOT NULL REFERENCES users(id),
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, project_id)
);

CREATE INDEX idx_user_project_roles_user_id ON user_project_roles(user_id);
CREATE INDEX idx_user_project_roles_project_id ON user_project_roles(project_id);
CREATE INDEX idx_user_project_roles_role ON user_project_roles(role);
```

## Enums and Constants

### Status Enums
```python
# Python Enums
class ScriptStatus(str, Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"
    DEPRECATED = "deprecated"

class ExecutionStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"

class StepStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"
    TIMEOUT = "timeout"

class UserRole(str, Enum):
    ADMIN = "admin"
    PROJECT_MANAGER = "project_manager"
    TESTER = "tester"
    VIEWER = "viewer"
```

### Constants
```python
# Application Constants
MAX_SCRIPT_NAME_LENGTH = 200
MAX_STEP_TIMEOUT_SECONDS = 300
DEFAULT_STEP_TIMEOUT_SECONDS = 10
MAX_RETRY_COUNT = 10
DEFAULT_RETRY_COUNT = 3
MAX_UPLOAD_SIZE_BYTES = 100 * 1024 * 1024  # 100MB
SCREENSHOT_FORMATS = ["png", "jpg", "webp"]
DEFAULT_SCREENSHOT_FORMAT = "png"
SUPPORTED_BROWSERS = ["chrome", "firefox", "safari", "edge"]
SUPPORTED_PLATFORMS = ["windows", "macos", "linux"]
```

## Data Validation Rules

### Input Validation
- **Script Names**: 1-200 characters, no special characters except spaces and hyphens
- **Email**: Valid email format using RFC 5322 standard
- **Usernames**: 3-50 characters, alphanumeric plus underscores
- **Version**: Semantic versioning format (x.y.z)
- **Timeout Values**: 1-300 seconds per step
- **Selector Values**: Non-empty strings, validated against selector type rules
- **JSON Content**: Valid JSON schema validation for test steps

### Business Rules
- Script names must be unique within a project
- Users can only have one role per project
- Script locks expire automatically after 24 hours
- Test results are immutable after creation
- Data files cannot be modified, only replaced with new versions
- Visual difference scores range from 0.00 to 100.00

## Data Migration Strategy

### Schema Evolution
- Use Alembic migrations for PostgreSQL schema changes
- Version the SQLite schema and implement migration scripts for client updates
- Maintain backward compatibility for at least 2 major versions
- Provide data export/import utilities for major schema changes

### Data Consistency
- Foreign key constraints ensure referential integrity
- Check constraints enforce business rules
- Triggers maintain audit trails and timestamps
- Periodic data cleanup jobs remove old test results and temporary files

## Performance Considerations

### Indexing Strategy
- **Read-heavy tables**: Comprehensive indexing on query patterns
- **Write-heavy tables**: Minimal indexing to optimize write performance
- **Composite indexes**: For common multi-column query patterns
- **Partial indexes**: For specific status or date-based queries

### Partitioning
- **test_executions**: Partition by created_at (monthly) for large datasets
- **test_step_results**: Partition by execution_id for efficient cleanup
- **Audit logs**: Partition by date for log retention policies

### Caching Strategy
- **User sessions**: Redis cache with expiration
- **Script metadata**: Application cache with invalidation on changes
- **Frequently accessed data**: Read replicas for reporting queries
- **Static assets**: CDN for screenshots and result files