<!--
Sync Impact Report:
Version change: 0.0.0 → 1.0.0 (initial constitution creation)
Modified principles: None (new constitution)
Added sections: All sections (Core Principles, Architecture Standards, Development Workflow, Governance)
Removed sections: None (new constitution)
Templates requiring updates:
✅ plan-template.md - Constitution Check section aligned
✅ spec-template.md - Requirements aligned with Testing-First principle
✅ tasks-template.md - Test structure aligned with Testing-First principle
⚠ No template updates needed - existing templates already support constitution principles

Follow-up TODOs: None - all placeholders filled with concrete values
-->

# UITrace Constitution

## Core Principles

### I. Client-Server Architecture
UITrace is a dual-component system: Rust/Tauri desktop client for high-performance test execution, and Python/FastAPI server for collaboration and data management. Desktop handles browser automation and test execution; Server handles script repository, user management, and result aggregation. All client-server communication must use authenticated REST APIs with structured JSON data.

### II. Test-First (NON-NEGOTIABLE)
TDD is mandatory for all business logic: Write failing tests first, ensure tests capture requirements accurately, then implement functionality to make tests pass. Test coverage must include unit tests for core logic, integration tests for API contracts, and end-to-end tests for critical user journeys. All tests must be automated and run in CI/CD pipelines.

### III. Fault-Tolerant Execution
All test scripts must support multiple selector strategies (ID, CSS, XPath) with intelligent retry mechanisms. When primary selectors fail, the system must automatically attempt alternative selectors within timeout windows. Script execution must be resilient to minor UI changes and provide detailed error logging for debugging failures. Visual assertions must support configurable similarity thresholds.

### IV. Data-Driven Testing (DDT)
All test scripts must support parameterization through external data sources (CSV, Excel). Test data files must be versioned separately from scripts and support dynamic variable substitution using `${variable}` syntax. Each data row should execute as an independent test case with isolated browser state and separate result reporting. Data validation and type checking must occur before test execution.

### V. Performance and Reliability
Desktop execution must achieve sub-500ms average step execution time (excluding network waits). All automation scripts must handle network latency and page loading asynchronously. System must support concurrent test execution across multiple browser instances. Server APIs must handle high-volume result ingestion without performance degradation. Resource cleanup and memory management are critical for long-running test sessions.

## Architecture Standards

### Technology Stack Requirements
Desktop client MUST use Rust with Tauri framework, `thirtyfour` for WebDriver automation, and Tokio for async operations. Frontend UI must use Vue 3 with TypeScript. Server MUST use Python with FastAPI, Pydantic for data validation, and SQLAlchemy with PostgreSQL. All client-server communication must use HTTPS with JWT authentication. Containerization using Docker is required for deployment.

### API Design Standards
All server APIs must follow RESTful conventions with OpenAPI specification. Request/response schemas must use Pydantic models with strict validation. All endpoints must require authentication tokens except for health checks and documentation. Error responses must follow consistent JSON format with error codes and human-readable messages. Rate limiting and request size limits must be implemented for all public APIs.

### Data Management Standards
Test scripts must be stored as versioned JSON files with schema validation. Test data files must support CSV and Excel formats with automatic type detection. All test results must include execution timestamps, duration metrics, and visual difference percentages. Database schemas must support audit trails for script changes and test execution history. Data retention policies must be configurable and automatically enforced.

### Security Standards
All user authentication must use JWT tokens with configurable expiration. API keys and secrets must be stored in encrypted format. File uploads must be scanned and validated for malware. Database connections must use TLS encryption. All test execution must run in sandboxed browser environments with restricted network access. Audit logging must track all user actions and system events.

## Development Workflow

### Code Review Process
All pull requests require at least one code review from a team member. Automated tests must pass before merge consideration. Code coverage must not decrease below current baseline. Security scanning must pass for all dependencies. Documentation updates must be included for any API or UI changes. Performance regression tests must pass for performance-critical components.

### Quality Gates
Pre-commit hooks must run code formatting and static analysis. Unit tests must achieve 90% code coverage minimum. Integration tests must validate all API contracts. End-to-end tests must complete successfully for critical user workflows. Performance benchmarks must meet or exceed defined thresholds. Security vulnerability scans must produce no high-severity findings.

### Release Process
Features must be developed in feature branches from main development branch. Continuous integration must run full test suite on every commit. Release branches must be created from tested main branch commits. Semantic versioning must be followed: MAJOR for breaking changes, MINOR for new features, PATCH for bug fixes. Release notes must include all user-impacting changes and migration instructions.

### Documentation Standards
API documentation must be auto-generated from OpenAPI specifications. Code documentation must explain complex algorithms and design decisions. User documentation must include getting started guides and troubleshooting sections. Architecture decision records (ADRs) must be created for significant design choices. All documentation must be kept in sync with code changes.

## Governance

This constitution supersedes all other development practices and guidelines. Amendments require formal documentation, team approval, and migration plans. All code reviews and development activities must verify compliance with constitutional principles. Complex implementations require explicit justification documenting why simpler alternatives are insufficient. Violations of constitution principles are only allowed for critical compatibility or performance reasons with documented trade-offs.

**Version**: 1.0.0 | **Ratified**: 2025-11-27 | **Last Amended**: 2025-11-27