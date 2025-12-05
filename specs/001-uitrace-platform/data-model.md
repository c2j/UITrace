# Data Model: UITrace Platform

**Date**: 2025-11-27
**Purpose**: Define data entities, relationships, and validation rules for UITrace platform

## Core Entities

### User

Represents authenticated users with role-based permissions.

```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- nullable for OAuth users
    full_name VARCHAR(255),
    avatar_url TEXT,
    auth_type VARCHAR(20) NOT NULL CHECK (auth_type IN ('local', 'oauth', 'saml')),
    oauth_provider VARCHAR(50), -- google, github, microsoft
    oauth_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Fields**:
- `id`: Unique identifier (UUID)
- `email`: User email (unique, required)
- `username`: Unique username (required)
- `password_hash`: Bcrypt hash for local auth
- `auth_type`: Authentication method
- `oauth_provider`: OAuth provider for external auth
- `oauth_id`: Provider-specific user ID

### Team

Organizational unit for grouping users and projects.

```sql
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

**Fields**:
- `id`: Unique identifier (UUID)
- `name`: Team display name
- `slug`: URL-friendly team identifier
- `description`: Optional team description
- `created_by`: User who created the team

### TeamMembership

Many-to-many relationship between users and teams.

```sql
CREATE TABLE team_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);
```

**Roles**:
- `owner`: Full control, can delete team
- `admin`: Manage team members and projects
- `member`: Create and edit scripts/projects
- `viewer`: Read-only access

### Project

Container for test scripts and execution results.

```sql
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    retention_days INTEGER DEFAULT 365,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(team_id, slug)
);
```

**Fields**:
- `retention_days`: Data retention policy for this project
- `slug`: Project identifier within team

### TestScript

Represents an automated test script.

```sql
CREATE TABLE test_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    version INTEGER NOT NULL DEFAULT 1,
    description TEXT,
    script_content JSONB NOT NULL, -- Serialized test steps
    metadata JSONB, -- Script metadata (tags, browser requirements, etc.)
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    is_locked_by UUID REFERENCES users(id) ON DELETE SET NULL, -- For collaboration
    file_path TEXT, -- Path to stored JSON file
    file_size BIGINT,
    checksum VARCHAR(64), -- SHA-256 hash
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, name, version)
);
```

**Script Content Schema**:
```json
{
  "id": "script-uuid",
  "name": "Login Test",
  "version": 1,
  "steps": [
    {
      "id": "step-1",
      "type": "navigate",
      "url": "https://example.com/login",
      "timeout": 5000
    },
    {
      "id": "step-2",
      "type": "type",
      "selectors": [
        {"type": "id", "value": "username"},
        {"type": "css", "value": "input[name='username']"},
        {"type": "xpath", "value": "//input[@id='username']"}
      ],
      "value": "${username}"
    }
  ],
  "variables": ["username", "password"]
}
```

### TestExecution

Represents a single execution of a test script.

```sql
CREATE TABLE test_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID REFERENCES test_scripts(id) ON DELETE CASCADE,
    execution_id VARCHAR(36) UNIQUE NOT NULL, -- UUID for tracking
    executed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    data_row_index INTEGER, -- For data-driven testing
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    browser_type VARCHAR(20),
    browser_version VARCHAR(50),
    error_message TEXT,
    error_stack TEXT,
    results JSONB, -- Detailed execution results
    metadata JSONB, -- Execution metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### TestStepResult

Results for individual steps within a test execution.

```sql
CREATE TABLE test_step_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID REFERENCES test_executions(id) ON DELETE CASCADE,
    step_id VARCHAR(255) NOT NULL, -- Reference to step in script
    status VARCHAR(20) NOT NULL CHECK (status IN ('passed', 'failed', 'skipped', 'warning')),
    start_time TIMESTAMP WITH TIME ZONE,
    end_time TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    selector_used VARCHAR(255), -- Which selector succeeded
    error_message TEXT,
    screenshot_path TEXT, -- Path to screenshot if taken
    visual_baseline_path TEXT, -- Path to baseline image
    visual_diff_path TEXT, -- Path to diff image
    visual_similarity DECIMAL(5,4), -- 0.0000 to 1.0000
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### VisualBaseline

Stores baseline images for visual testing.

```sql
CREATE TABLE visual_baselines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID REFERENCES test_scripts(id) ON DELETE CASCADE,
    step_id VARCHAR(255) NOT NULL,
    browser_type VARCHAR(20),
    viewport_width INTEGER,
    viewport_height INTEGER,
    baseline_path TEXT NOT NULL,
    similarity_threshold DECIMAL(5,4) DEFAULT 0.9500,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(script_id, step_id, browser_type, viewport_width, viewport_height)
);
```

### TestDataFile

Files containing data for data-driven testing.

```sql
CREATE TABLE test_data_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('csv', 'xlsx', 'json')),
    file_size BIGINT,
    checksum VARCHAR(64),
    column_info JSONB, -- Column names, types, validation rules
    row_count INTEGER,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### AuditLog

Tracks all changes for compliance and debugging.

```sql
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type VARCHAR(50) NOT NULL, -- user, team, project, script, etc.
    entity_id UUID NOT NULL,
    action VARCHAR(50) NOT NULL, -- create, update, delete, execute, etc.
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Data Validation Rules

### Email Validation
- Must match RFC 5322 email format
- Case-insensitive uniqueness

### Password Policy
- Minimum 12 characters
- Require uppercase, lowercase, number, and special character
- Cannot contain username or email

### Script Validation
- JSON schema validation for script content
- Required fields: steps array, each step with type and at least one selector
- Variable references must be defined in variables array

### File Upload Validation
- Max file size: 100MB for scripts, 10MB for data files
- Allowed MIME types for screenshots: image/png, image/jpeg
- CSV files must have headers, max 1000 columns
- Excel files limited to .xlsx format

## Performance Considerations

### Indexes
```sql
-- Performance indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_team_memberships_team_user ON team_memberships(team_id, user_id);
CREATE INDEX idx_projects_team_active ON projects(team_id) WHERE is_active = true;
CREATE INDEX idx_test_scripts_project_version ON test_scripts(project_id, version DESC);
CREATE INDEX idx_test_executions_script_status ON test_executions(script_id, status);
CREATE INDEX idx_test_executions_created_at ON test_executions(created_at DESC);
CREATE INDEX idx_test_step_results_execution ON test_step_results(execution_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
```

### Partitioning
- `test_executions` partitioned by created_at (monthly)
- `test_step_results` partitioned by execution_id (inherited from executions)
- `audit_logs` partitioned by created_at (quarterly)

## Data Retention Policies

### Automated Cleanup
- Test executions: Delete after project retention_days
- Screenshots and diffs: Delete after 2x retention_days
- Audit logs: Archive after 1 year, delete after 7 years
- Temporary files: Delete after 24 hours

### Soft Deletes
- Users: Deactivate, don't delete (preserve audit trail)
- Teams/Projects: Soft delete with delayed permanent removal
- Scripts: Version history preserved, latest version can be deleted

## Security Considerations

### Encryption
- Password hashes: bcrypt with cost factor 12
- JWT secrets: 256-bit keys stored in environment
- Database connections: TLS 1.3
- File storage: Encryption at rest for sensitive data

### Access Control
- Row-level security for team-based access
- API rate limiting per user/IP
- File access validation through ownership checks
- Audit logging for all data modifications