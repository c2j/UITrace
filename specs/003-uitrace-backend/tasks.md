---

description: "Task list for UITrace Backend Service Implementation"
---

# Tasks: UITrace Backend Service Implementation

**Input**: Design documents from `/specs/001-uitrace-backend/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Unit tests included (Jest), Integration tests included (Supertest)

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [X] T001 Create backend project structure per implementation plan
- [X] T002 Initialize Node.js project with TypeScript and dependencies (Fastify, Prisma, Playwright, Socket.io)
- [X] T003 [P] Configure ESLint and Prettier with backend-specific rules
- [X] T004 [P] Setup Jest testing framework with Supertest for API testing
- [X] T005 Create Docker Compose configuration for PostgreSQL and MinIO
- [X] T006 Initialize Git repository with .gitignore for Node.js
- [X] T007 Create environment configuration template (.env.example)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T008 Setup Prisma schema with all entities from data model
- [X] T009 [P] Implement JWT authentication middleware
- [X] T010 [P] Setup Fastify server with basic middleware structure
- [X] T011 [P] Implement unified error handler with structured responses
- [X] T012 [P] Setup Pino structured logging with correlation IDs
- [X] T013 [P] Create base repository pattern for database operations
- [X] T014 [P] Setup Redis client for caching and queues
- [X] T015 [P] Configure S3/MinIO client for object storage
- [X] T016 Implement Zod validation schemas for common types
- [X] T017 Create /health endpoint for monitoring
- [X] T018 Setup database connection pooling

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Test Script Management (Priority: P1) 🎯 MVP

**Goal**: Manage hierarchical test organization (Projects → Versions → Modules → Scripts)

**Independent Test**: Create projects, versions, modules, and scripts through the API; verify hierarchy is preserved and scripts store step definitions

### Tests for User Story 1

- [X] T019 [P] [US1] Contract test for /projects endpoints in tests/contract/test-projects.test.ts
- [X] T020 [P] [US1] Contract test for /scripts endpoints in tests/contract/test-scripts.test.ts
- [X] T021 [P] [US1] Integration test for script hierarchy in tests/integration/test-script-management.test.ts

### Implementation for User Story 1

- [X] T022 [P] [US1] Create Project entity and repository in backend/src/modules/project/repository.ts
- [X] T023 [P] [US1] Create Version entity and repository in backend/src/modules/version/repository.ts
- [X] T024 [P] [US1] Create Module entity and repository in backend/src/modules/module/repository.ts
- [X] T025 [P] [US1] Create Script entity and repository in backend/src/modules/script/repository.ts
- [X] T026 [US1] Implement ProjectService in backend/src/modules/project/service.ts
- [X] T027 [US1] Implement VersionService with inheritance logic in backend/src/modules/version/service.ts
- [X] T028 [US1] Implement ModuleService in backend/src/modules/module/service.ts
- [X] T029 [US1] Implement ScriptService with step validation in backend/src/modules/script/service.ts
- [X] T030 [US1] Create ProjectController in backend/src/modules/project/controller.ts
- [X] T031 [US1] Create ScriptController in backend/src/modules/script/controller.ts
- [X] T032 [US1] Add project routes in backend/src/routes/projects.ts
- [X] T033 [US1] Add script routes in backend/src/routes/scripts.ts
- [X] T034 [US1] Implement Zod schemas for script steps validation in backend/src/modules/script/dto/
- [X] T035 [US1] Add request validation middleware for all endpoints

**Checkpoint**: ✅ At this point, User Story 1 is fully functional and testable independently

---

## Phase 4: User Story 2 - Test Execution & Results (Priority: P1)

**Goal**: Execute test scripts and provide real-time results with logs, screenshots, and visual diffs

**Independent Test**: Execute scripts via API; verify execution records, logs streaming, screenshots captured, and visual diffs calculated

### Tests for User Story 2

- [X] T036 [P] [US2] Contract test for script execution in tests/contract/test-execution.test.ts
- [X] T037 [P] [US2] Integration test for real-time results in tests/integration/test-execution-flow.test.ts

### Implementation for User Story 2

- [X] T038 [P] [US2] Create Execution entity and repository in backend/src/modules/execution/repository.ts
- [X] T039 [P] [US2] Create ExecutionLog entity and repository in backend/src/modules/execution/log-repository.ts
- [X] T040 [US2] Create VisualDiff entity and repository in backend/src/modules/execution/visual-diff-repository.ts
- [X] T041 [US2] Implement ExecutionService for job management in backend/src/modules/execution/service.ts
- [X] T042 [US2] Implement WebSocket server for real-time updates in backend/src/libs/websocket.ts
- [X] T043 [US2] Create Playwright driver for script execution in backend/agent/driver.ts
- [X] T044 [US2] Implement visual diff service with pixelmatch in backend/src/modules/execution/visual-diff-service.ts
- [X] T045 [US2] Create ExecutionController in backend/src/modules/execution/controller.ts
- [X] T046 [US2] Add execution routes in backend/src/routes/executions.ts
- [X] T047 [US2] Implement async job processing with BullMQ in backend/src/libs/queue.ts
- [X] T048 [US2] Create agent registration endpoint in backend/src/modules/agent/controller.ts
- [X] T049 [US2] Add correlation ID tracking for execution logs

**Checkpoint**: ✅ User Stories 1 AND 2 are fully implemented and functional

---

## Phase 5: User Story 3 - Multi-Node Execution & Infrastructure Management (Priority: P2)

**Goal**: Register and monitor execution nodes for distributed testing

**Independent Test**: Register nodes via WebSocket; monitor heartbeats; dispatch jobs based on capabilities; handle disconnections

### Tests for User Story 3

- [ ] T050 [P] [US3] Contract test for node management in tests/contract/test-nodes.test.ts
- [ ] T051 [P] [US3] Integration test for node heartbeat in tests/integration/test-node-lifecycle.test.ts

### Implementation for User Story 3

- [ ] T052 [P] [US3] Create ServerNode entity and repository in backend/src/modules/node/repository.ts
- [ ] T053 [US3] Implement NodeService for capability matching in backend/src/modules/node/service.ts
- [ ] T054 [US3] Create NodeController with registration endpoints in backend/src/modules/node/controller.ts
- [ ] T055 [US3] Implement heartbeat monitoring with timeout detection in backend/src/modules/node/heartbeat-monitor.ts
- [ ] T056 [US3] Add job dispatcher for routing based on capabilities in backend/src/queue/dispatcher.ts
- [ ] T057 [US3] Create agent client for WebSocket communication in backend/agent/agent.ts
- [ ] T058 [US3] Add node routes in backend/src/routes/nodes.ts
- [ ] T059 [US3] Implement node status management (online/offline/busy)

**Checkpoint**: All core user stories (US1-3) should now be independently functional

---

## Phase 6: User Story 4 - Visual Regression Management (Priority: P2)

**Goal**: Manage visual baselines and approve/reject visual changes

**Independent Test**: Run visual tests; create baselines; introduce changes; use approval workflow

### Tests for User Story 4

- [ ] T060 [P] [US4] Contract test for baseline management in tests/contract/test-baselines.test.ts
- [ ] T061 [P] [US4] Integration test for visual approval workflow in tests/integration/test-visual-regression.test.ts

### Implementation for User Story 4

- [ ] T062 [P] [US4] Create Baseline entity and repository in backend/src/modules/baseline/repository.ts
- [ ] T063 [US4] Implement BaselineService for approval workflow in backend/src/modules/baseline/service.ts
- [ ] T064 [US4] Create baseline comparison with diff images in backend/src/modules/baseline/comparator.ts
- [ ] T065 [US4] Add baseline management endpoints in backend/src/routes/baselines.ts
- [ ] T066 [US4] Implement visual diff viewer API in backend/src/modules/execution/visual-viewer.ts
- [ ] T067 [US4] Create baseline approval endpoints in backend/src/modules/baseline/controller.ts
- [ ] T068 [US4] Add environment-specific baseline storage

**Checkpoint**: Visual regression capabilities fully integrated

---

## Phase 7: User Story 5 - Performance & Analytics (Priority: P3)

**Goal**: View test execution statistics and trends

**Independent Test**: Run multiple executions; generate statistics; verify dashboard data accuracy

### Tests for User Story 5

- [ ] T069 [P] [US5] Contract test for analytics endpoints in tests/contract/test-analytics.test.ts
- [ ] T070 [P] [US5] Integration test for statistics aggregation in tests/integration/test-analytics.test.ts

### Implementation for User Story 5

- [ ] T071 [P] [US5] Create analytics service for aggregation in backend/src/modules/analytics/service.ts
- [ ] T072 [US5] Implement statistics calculation jobs in backend/src/jobs/calculate-stats.ts
- [ ] T073 [US5] Create AnalyticsController with dashboard endpoints in backend/src/modules/analytics/controller.ts
- [ ] T074 [US5] Add analytics routes in backend/src/routes/analytics.ts
- [ ] T075 [US5] Implement trend analysis for flaky test detection
- [ ] T076 [US5] Create performance monitoring dashboard data

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T077 [P] Implement rate limiting middleware in backend/src/middleware/rate-limit.ts
- [ ] T078 [P] Add request/response compression in backend/src/middleware/compression.ts
- [ ] T079 [P] Setup Sentry for error tracking in backend/src/libs/sentry.ts
- [ ] T080 [P] Create comprehensive API documentation in backend/docs/
- [ ] T081 [P] Add performance monitoring middleware in backend/src/middleware/metrics.ts
- [ ] T082 Implement database query optimization and indexing
- [ ] T083 Add comprehensive unit tests for all services (target: >70% coverage)
- [ ] T084 Create Dockerfile for production deployment
- [ ] T085 Setup CI/CD pipeline configuration
- [ ] T086 Add database seeders with sample data
- [ ] T087 Implement data retention policies for old executions
- [ ] T088 Add security headers and CORS configuration
- [ ] T089 Create performance test suite with Artillery
- [ ] T090 Validate quickstart.md setup instructions
- [ ] T091 Update OpenAPI documentation with all endpoints
- [ ] T092 Create deployment documentation

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (US1 & US2 → US3 & US4 → US5)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational - No dependencies on other stories
- **User Story 2 (P1)**: Can start after Foundational - Integrates with US1 for script data
- **User Story 3 (P2)**: Can start after Foundational - Integrates with US2 for job dispatch
- **User Story 4 (P2)**: Depends on US2 for execution data
- **User Story 5 (P3)**: Depends on US1, US2, US3, US4 for analytics data

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Repositories before services
- Services before controllers
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, US1 & US2 can start in parallel
- All tests for a user story marked [P] can run in parallel
- Repositories within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1 & 2 (MVP)

```bash
# Launch all tests for MVP stories together:
Task: "Contract test for /projects endpoints in tests/contract/test-projects.test.ts"
Task: "Contract test for /scripts endpoints in tests/contract/test-scripts.test.ts"
Task: "Contract test for script execution in tests/contract/test-execution.test.ts"

# Launch all repositories for MVP together:
Task: "Create Project entity and repository in backend/src/modules/project/repository.ts"
Task: "Create Version entity and repository in backend/src/modules/version/repository.ts"
Task: "Create Module entity and repository in backend/src/modules/module/repository.ts"
Task: "Create Script entity and repository in backend/src/modules/script/repository.ts"
Task: "Create Execution entity and repository in backend/src/modules/execution/repository.ts"
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. Complete Phase 4: User Story 2
5. **STOP and VALIDATE**: Test script management and execution independently
6. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Add User Story 4 → Test independently → Deploy/Demo
6. Add User Story 5 → Test independently → Deploy/Demo
7. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together (3-4 days)
2. Once Foundational is done:
   - Developer A: User Story 1 (Script Management)
   - Developer B: User Story 2 (Execution Engine)
   - Developer C: User Story 3 (Node Management - starts after US2 partially done)
3. Stories complete and integrate independently
4. Developer A/B move to US4, Developer C to US5

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
- MVP consists of US1 + US2 for core script management and execution