# UITrace Backend

High-performance UI automation testing platform backend service.

## Prerequisites

- Node.js ≥ 20 (LTS)
- Docker & Docker Compose
- PostgreSQL (running via Docker Compose)
- Redis (running via Docker Compose)
- MinIO (running via Docker Compose)

## Quick Start

1. **Clone and navigate to the backend directory**
   ```bash
   cd backend
   ```

2. **Copy environment configuration**
   ```bash
   cp .env.example .env
   ```

3. **Start required services**
   ```bash
   docker-compose up -d
   ```

4. **Install dependencies**
   ```bash
   npm install
   ```

5. **Generate Prisma client**
   ```bash
   npx prisma generate
   ```

6. **Run database migrations**
   ```bash
   npx prisma migrate dev --name init
   ```

7. **Start the development server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`

## API Documentation

- Swagger UI: `http://localhost:3000/docs`
- OpenAPI JSON: `http://localhost:3000/docs/json`

## Development Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Run ESLint with auto-fix
- `npm run format` - Format code with Prettier
- `npm run typecheck` - Run TypeScript type checking

## Database Operations

- `npm run db:migrate` - Run database migrations
- `npm run db:generate` - Generate Prisma client
- `npm run db:studio` - Open Prisma Studio

## Project Structure

```
backend/
├── src/
│   ├── config/          # Environment variables and configuration
│   ├── modules/         # Business modules (project, script, execution, etc.)
│   ├── middleware/      # Express/Fastify middleware
│   ├── routes/          # API route definitions
│   ├── utils/           # Utility functions and helpers
│   ├── libs/            # Third-party service wrappers (Redis, S3)
│   ├── app.ts           # Fastify app setup
│   └── server.ts        # Server entry point
├── tests/               # Test files (unit, integration, contract)
├── prisma/              # Database schema and migrations
├── agent/               # Execution agent code
└── docker-compose.yml   # Development environment services
```

## Architecture

The backend follows a modular architecture with clear separation of concerns:

- **Controller Layer**: Handles HTTP requests and responses
- **Service Layer**: Contains business logic and orchestration
- **Repository Layer**: Database operations and data access
- **Middleware**: Cross-cutting concerns (auth, validation, logging)
- **Routes**: API endpoint definitions and documentation

## User Stories Implementation

### ✅ Phase 1 & 2: Complete
- Project setup and tooling
- Database schema and models
- Authentication and error handling
- Logging and monitoring

### ✅ Phase 3: User Story 1 - Test Script Management
- Project, Version, Module, and Script CRUD operations
- Hierarchical test organization
- Script step validation
- Search and filtering capabilities

### 🚧 Phase 4: User Story 2 - Test Execution & Results
- Script execution engine
- Real-time results streaming
- Screenshot capture and visual diffs
- Execution logs and history

### 📋 Phase 5-7: Planned
- Multi-node execution management
- Visual regression workflows
- Performance analytics and reporting

## Testing

The project uses a multi-layered testing approach:

- **Unit Tests**: Individual function and class testing
- **Integration Tests**: API endpoint and workflow testing
- **Contract Tests**: API specification compliance
- **E2E Tests**: Full user journey testing

## Environment Variables

See `.env.example` for all available configuration options. Key variables:

- `NODE_ENV`: Development/production mode
- `DATABASE_URL`: PostgreSQL connection string
- `REDIS_HOST`: Redis server host
- `JWT_SECRET`: JWT signing secret
- `S3_ENDPOINT`: MinIO/S3 endpoint for file storage

## Docker Services

The `docker-compose.yml` includes:

- **PostgreSQL**: Primary database
- **Redis**: Caching and job queue
- **MinIO**: S3-compatible object storage with UI at `http://localhost:9001`

## Contributing

1. Follow TypeScript strict mode guidelines
2. Write tests for new features
3. Keep API documentation updated
4. Use conventional commit messages
5. Run linting before committing

## License

MIT License - see LICENSE file for details