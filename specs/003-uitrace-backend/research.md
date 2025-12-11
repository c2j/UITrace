# Research Document: UITrace Backend Implementation

**Date**: 2025-12-10
**Purpose**: Resolving technical decisions for UITrace backend implementation

## Decisions Made

### 1. Web Framework Choice: Fastify vs Express

**Decision**: Fastify

**Rationale**:
- 2x faster performance out of the box
- Built-in TypeScript support
- Schema validation integrated
- Lower overhead with plugins vs Express middleware
- Better suited for high-throughput API (1000+ QPS requirement)

**Alternatives considered**:
- Express: More mature ecosystem, larger community
- Koa: Simpler async/await flow but smaller ecosystem

### 2. Database Access Pattern: Prisma vs Direct SQL

**Decision**: Prisma with PostgreSQL

**Rationale**:
- Type-safe database access
- Automatic migrations
- Excellent TypeScript integration
- Query optimization while maintaining simplicity
- Reduces boilerplate for CRUD operations

**Alternatives considered**:
- Direct SQL with pg: More control but more verbose
- TypeORM: Heavier, more complex configuration

### 3. Job Queue Implementation: BullMQ vs In-Process

**Decision**: BullMQ with Redis (deferred to v1.5 per MVP constitution)

**Rationale for MVP**:
- Simple in-process queue for immediate test execution
- Async/await pattern sufficient for MVP
- Reduces operational complexity

**Future (v1.5)**:
- BullMQ for retry logic, job priorities, and delayed execution
- Redis for persistence and reliability

### 4. Real-time Communication: WebSocket vs Server-Sent Events

**Decision**: WebSocket with Socket.io

**Rationale**:
- Bidirectional communication required for agent heartbeat
- Socket.io provides fallbacks and room management
- Native support for agent registration/dispatch
- Built-in reconnection logic

**Alternatives considered**:
- SSE: Unidirectional only
- Raw WebSocket: More manual handling of connection management

### 5. Object Storage: MinIO vs AWS S3

**Decision**: MinIO for development, S3-compatible interface for production

**Rationale**:
- Local development with MinIO in Docker
- Same S3 API works with AWS, DigitalOcean Spaces, etc.
- Cost-effective for large screenshot/test artifacts
- Presigned URLs for secure direct agent uploads

### 6. Authentication Strategy

**Decision**: JWT with role-based claims (RBAC)

**Rationale**:
- Stateless, scales well
- Easy role checking (Admin, Tester, Viewer)
- Compatible with future OAuth2 upgrade
- Simple middleware implementation

**Token structure**:
```json
{
  "sub": "user-id",
  "roles": ["tester"],
  "exp": 1234567890
}
```

### 7. Visual Diff Algorithm

**Decision**: pixelmatch with sharp for image processing

**Rationale**:
- pixelmatch is industry standard for visual regression
- Sharp provides fast image processing
- Can calculate diff percentage accurately
- Supports different image formats and resolutions

### 8. Playwright Integration Architecture

**Decision**: Generic driver interpreting JSON steps

**Rationale**:
- No code generation security risks
- Dynamic error handling and self-healing
- Easier to implement selector priority fallback
- Real-time step-by-step logging

**Sample step JSON**:
```json
{
  "id": 1,
  "name": "Login Button",
  "action": "click",
  "selectors": [
    {"type": "id", "value": "login-btn", "priority": 1},
    {"type": "css", "value": "button[type='submit']", "priority": 2}
  ]
}
```

### 9. Agent Deployment Strategy

**Decision**: Standalone Node.js package

**Rationale**:
- Can run on any OS with Node.js
- Lightweight for execution nodes
- WebSocket connection keeps agent stateless
- Docker optional for containerized environments

### 10. Error Handling Strategy

**Decision**: Centralized error middleware with error codes

**Rationale**:
- Consistent error responses across all endpoints
- Error codes for i18n support
- Structured logging for debugging
- Sentry integration for production errors

**Error response format**:
```json
{
  "success": false,
  "error": {
    "code": "SCRIPT_NOT_FOUND",
    "message": "Script with ID xxx not found"
  }
}
```

## Architecture Constraints from MVP Constitution

1. **No microservices**: All functionality in single backend service
2. **Single database instance**: PostgreSQL without read replicas
3. **Simple caching**: In-memory or Redis single instance
4. **No complex auth flows**: JWT only, no OAuth2 initially
5. **File-based logs**: Pino to file, no ELK stack initially

## Performance Optimization Strategies

1. **Database**: Connection pooling, proper indexing, query optimization
2. **API**: Response compression, request validation, rate limiting
3. **File storage**: CDN for artifacts, presigned URLs
4. **WebSocket**: Room-based broadcasting, connection pooling
5. **Visual diffs**: Lazy loading, thumbnail generation

## Security Considerations

1. **API**: Rate limiting, input validation, SQL injection prevention
2. **Auth**: JWT expiration, refresh tokens, secure cookie flags
3. **Storage**: Presigned URLs with expiration, virus scanning
4. **Network**: HTTPS only, CORS configuration
5. **Agent**: Node authentication, capability matching

## Monitoring and Observability

1. **Logging**: Pino structured logs with correlation IDs
2. **Health checks**: /health endpoint with database status
3. **Metrics**: Request duration, error rates, queue size
4. **Tracing**: Request ID tracking across services
5. **Alerts**: Sentry for errors, custom alerts for SLAs