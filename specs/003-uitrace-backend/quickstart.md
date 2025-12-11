# Quickstart Guide: UITrace Backend Development

**Purpose**: Get the UITrace backend running locally for development and testing

## Prerequisites

- Node.js 20+ LTS
- Docker & Docker Compose
- Git

## Environment Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd UITrace
git checkout 001-uitrace-backend
```

### 2. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

### 3. Configure Environment (.env)
```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/uitrace"

# Redis (for job queue, can use in-memory for MVP)
REDIS_URL="redis://localhost:6379"

# JWT Secret
JWT_SECRET="your-super-secret-jwt-key-change-in-production"

# Server Configuration
PORT=3000
HOST=0.0.0.0

# Object Storage (MinIO for dev)
S3_ENDPOINT="http://localhost:9000"
S3_ACCESS_KEY="minioadmin"
S3_SECRET_KEY="minioadmin"
S3_BUCKET="uitrace-artifacts"

# Frontend URL (for CORS)
FRONTEND_URL="http://localhost:5173"
```

### 4. Docker Services
```bash
# Start PostgreSQL and MinIO
docker-compose up -d postgres minio

# Wait for services to be ready
# Check: http://localhost:9000 (MinIO console)
# User: minioadmin / Password: minioadmin
```

### 5. Database Setup
```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev --name init

# Seed initial data (optional)
npx prisma db seed
```

## Running the Application

### Development Mode
```bash
# Start backend with hot reload
npm run dev

# Start execution agent (in separate terminal)
npm run agent:dev
```

### Production Mode
```bash
# Build application
npm run build

# Start production server
npm start

# Start agent
npm run agent:start
```

## API Documentation

### Local Access
- API Base URL: http://localhost:3000/api/v1
- OpenAPI Spec: http://localhost:3000/api/v1/docs
- Health Check: http://localhost:3000/api/v1/health

### Authentication
```bash
# Create admin user (first time only)
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123","role":"admin"}'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@test.com","password":"password123"}'

# Use returned token for authenticated requests
curl -X GET http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer <jwt-token>"
```

## Test Your Setup

### 1. Create a Project
```bash
curl -X POST http://localhost:3000/api/v1/projects \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"My Test Project","icon":"rocket"}'
```

### 2. Create a Version
```bash
curl -X POST http://localhost:3000/api/v1/projects/<project-id>/versions \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"name":"v1.0.0","status":"active"}'
```

### 3. Create a Simple Script
```bash
curl -X POST http://localhost:3000/api/v1/scripts \
  -H "Authorization: Bearer <jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Login Test",
    "moduleId": "<module-id>",
    "priority": "P1",
    "steps": [
      {
        "id": 1,
        "name": "Navigate to login page",
        "action": "navigate",
        "value": "https://example.com/login",
        "selectors": []
      },
      {
        "id": 2,
        "name": "Enter email",
        "action": "type",
        "value": "test@example.com",
        "selectors": [
          {"type": "id", "value": "email", "priority": 1}
        ]
      }
    ]
  }'
```

### 4. Run the Script
```bash
curl -X POST http://localhost:3000/api/v1/scripts/<script-id>/run \
  -H "Authorization: Bearer <jwt-token>"
```

## Development Workflow

### 1. Making Changes
```bash
# Edit source code
# Changes auto-reload in development mode

# If database schema changes:
npx prisma migrate dev --name <change-description>
```

### 2. Running Tests
```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

### 3. Linting and Formatting
```bash
# Check linting
npm run lint

# Auto-fix
npm run lint:fix

# Format code
npm run format
```

## Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Reset database
docker-compose down
docker volume rm uitrace_postgres_data
docker-compose up -d postgres
npx prisma migrate dev
```

### Agent Connection Issues
- Ensure WebSocket port (3001) is open
- Check agent configuration matches server URL
- Verify JWT token is valid

### Object Storage Issues
- Verify MinIO is running on port 9000
- Check bucket exists in MinIO console
- Ensure access keys are correct

### Common Errors
- **"JWT expired"**: Login again to get new token
- **"Script not found"**: Verify script ID is correct
- **"Agent offline"**: Check agent is running and connected

## Next Steps

1. Review the [data model](data-model.md) to understand entities
2. Check the [research notes](research.md) for technical decisions
3. Start implementing features following the [task list](tasks.md)
4. Set up your IDE with recommended extensions (ESLint, Prettier, Prisma)

## Architecture Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend   │────▶│ PostgreSQL  │
└─────────────┘     └─────────────┘     └─────────────┘
                           │                     │
                           ▼                     ▼
                    ┌─────────────┐     ┌─────────────┐
                    │   Redis     │     │   MinIO     │
                    │  (Queue)    │     │ (Storage)   │
                    └─────────────┘     └─────────────┘
                           │
                           ▼
                    ┌─────────────┐
                    │  Execution  │
                    │   Agent(s)  │
                    └─────────────┘
```

## Performance Tips

1. Use database indexes for frequently queried fields
2. Enable response compression in production
3. Configure connection pooling for PostgreSQL
4. Use CDN for static artifacts in production
5. Monitor memory usage with large test suites