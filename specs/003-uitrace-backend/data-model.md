# Data Model: UITrace Backend

**Date**: 2025-12-10
**Based on**: Feature specification and OpenAPI schema

## Entity Relationships

```
Project
├── Version (1:N)
    ├── Module (1:N)
        └── Script (1:N)
            └── Execution (1:N)
                ├── ExecutionLog (1:N)
                └── VisualDiff (1:N)

ServerNode (independent)
Baseline (independent, linked to Script)
```

## Entity Definitions

### Project
**Purpose**: Root container for test automation projects

**Attributes**:
- `id`: UUID (primary key)
- `name`: String (unique, required)
- `icon`: String? (optional icon identifier)
- `createdAt`: DateTime
- `updatedAt`: DateTime

**Validation Rules**:
- Name: 2-100 characters, alphanumeric + spaces
- Icon: Optional, must match predefined icon set

### Version
**Purpose**: Semantic versioned snapshot of a project

**Attributes**:
- `id`: UUID (primary key)
- `projectId`: UUID (foreign key → Project)
- `name`: String (e.g., "v1.0.0", "v1.1.0-beta")
- `status`: Enum ('active', 'archived', 'draft')
- `releaseDate`: DateTime?
- `createdAt`: DateTime
- `updatedAt`: DateTime

**Validation Rules**:
- Name: Must follow semantic versioning pattern
- Status: Must be one of defined enums
- Release date: Optional, null for draft versions

### Module
**Purpose**: Logical grouping of test scripts

**Attributes**:
- `id`: UUID (primary key)
- `versionId`: UUID (foreign key → Version)
- `name`: String (required)
- `description`: String?
- `inheritedFrom`: UUID? (foreign key → Module in parent version)
- `createdAt`: DateTime
- `updatedAt`: DateTime

**Validation Rules**:
- Name: 2-100 characters within version
- Inheritance: Can only inherit from parent version
- Circular inheritance prevention required

### Script
**Purpose**: Test automation definition

**Attributes**:
- `id`: UUID (primary key)
- `moduleId`: UUID (foreign key → Module)
- `name`: String (required)
- `description`: String?
- `priority`: Enum ('P0', 'P1', 'P2')
- `lastRunStatus`: Enum? ('PASS', 'FAIL', 'SKIP', 'PENDING')
- `steps`: JSON (array of step objects)
- `createdAt`: DateTime
- `updatedAt`: DateTime

**Step Object Schema**:
```json
{
  "id": Number,
  "name": String,
  "action": Enum['navigate', 'click', 'type', 'assert_text', 'screenshot', 'wait'],
  "value": String?,
  "selectors": [{
    "type": Enum['id', 'css', 'xpath', 'text'],
    "value": String,
    "priority": Number
  }],
  "expectedValue": String?,
  "timeout": Number?
}
```

### Execution
**Purpose**: Record of test run

**Attributes**:
- `id`: UUID (primary key)
- `scriptId`: UUID (foreign key → Script)
- `status`: Enum ('PENDING', 'RUNNING', 'PASS', 'FAIL', 'SKIP', 'TIMEOUT')
- `startTime`: DateTime
- `endTime`: DateTime?
- `durationMs`: Number?
- `environment`: String (e.g., "Chrome 120 (Windows 11)")
- `triggeredBy`: String
- `nodeId`: UUID? (foreign key → ServerNode)
- `qualityScore`: Number? (0-100)
- `traceFileKey`: String? (S3 key for trace.zip)

**Validation Rules**:
- Duration: Auto-calculated from start/end times
- Quality score: Calculated from passed steps and errors
- Environment: Format: "Browser version (OS)"

### ExecutionLog
**Purpose**: Timestamped log entries

**Attributes**:
- `id`: UUID (primary key)
- `executionId`: UUID (foreign key → Execution)
- `timestamp`: DateTime
- `level`: Enum ('DEBUG', 'INFO', 'WARN', 'ERROR')
- `message`: String
- `stepId`: Number?

**Validation Rules**:
- Message: Max 10KB
- Timestamp: Auto-generated
- Step ID: Optional, links to script step

### VisualDiff
**Purpose**: Visual comparison result

**Attributes**:
- `id`: UUID (primary key)
- `executionId`: UUID (foreign key → Execution)
- `stepId`: Number
- `baselineKey`: String (S3 key)
- `actualKey`: String (S3 key)
- `diffKey`: String? (S3 key for diff image)
- `diffPercentage`: Float
- `tolerance`: Float (default: 0.1)
- `approved`: Boolean (default: false)

**Validation Rules**:
- Diff percentage: 0-100
- Tolerance: 0-1, affects pass/fail determination

### ServerNode
**Purpose**: Registered execution agent

**Attributes**:
- `id`: UUID (primary key)
- `name`: String
- `ip`: String
- `status`: Enum ('ONLINE', 'OFFLINE', 'BUSY', 'MAINTENANCE')
- `os`: String
- `browsers`: JSON (array of browser capabilities)
- `lastHeartbeat`: DateTime
- `hardwareStats`: JSON (cpu, memory, disk usage)

**Browser Capability Schema**:
```json
{
  "name": String, // "chrome", "firefox", "safari"
  "version": String,
  "platform": String // "windows", "macos", "linux"
}
```

### Baseline
**Purpose**: Reference image for visual comparison

**Attributes**:
- `id`: UUID (primary key)
- `scriptId`: UUID (foreign key → Script)
- `stepId`: Number
-environment`: String
- `s3Key`: String
- `approvedAt`: DateTime
- `approvedBy`: String

**Validation Rules**:
- Unique constraint: (scriptId, stepId, environment)
- Environment matches execution environment format

## Indexes

### Performance Indexes
1. `Project` → `name` (unique)
2. `Version` → `(projectId, status)`
3. `Script` → `lastRunStatus`
4. `Execution` → `(status, startTime)`
5. `ExecutionLog` → `(executionId, timestamp)`
6. `VisualDiff` → `(executionId, stepId)`
7. `ServerNode` → `status`

### Query Patterns
1. Project listing with version summaries
2. Scripts by status (failed, pending, etc.)
3. Executions by time range
4. Real-time log streaming
5. Node capability matching

## Data Retention Policies

### Per MVP Requirements
- **Executions**: Keep 90 days
- **Logs**: Keep 30 days
- **VisualDiffs**: Keep 90 days, then archive baselines only
- **Traces**: Keep 7 days (large files)

### Archive Strategy
- Move old data to `archived_*` tables
- Compress and store in cold storage
- Maintain aggregated statistics

## State Transitions

### Execution Status
```
PENDING → RUNNING → [PASS|FAIL|TIMEOUT]
    ↓
  SKIP (manual)
```

### ServerNode Status
```
OFFLINE → ONLINE → BUSY → ONLINE
    ↓
MAINTENANCE → ONLINE
```

### Version Status
```
DRAFT → ACTIVE → ARCHIVED
```

## Validation Rules Summary

1. **Referential Integrity**: All foreign keys must exist
2. **Cascade Deletes**: Scripts → Executions → Logs/Diffs
3. **Soft Deletes**: Projects, Versions (mark as deleted)
4. **Uniqueness**: Project names, (Script, Version, Module) names
5. **JSON Schema**: Validation for steps, browsers, hardwareStats