# UITrace Server

FastAPI-based server for the UITrace platform - Centralized Test Management System.

## Overview

UITrace Server provides a comprehensive RESTful API for managing UI automation tests, including user management, project organization, script versioning, test execution, and team collaboration.

## Features

- **User Management**: Authentication, authorization, role-based access control
- **Project Management**: Organize tests into projects with environments and webhooks
- **Script Management**: Version-controlled test scripts with scheduling
- **Test Execution**: Run tests with detailed reporting and artifact collection
- **Visual Testing**: Screenshot comparison with baseline management
- **Team Collaboration**: Multi-user support with teams and permissions
- **API Access**: RESTful API with comprehensive documentation

## Tech Stack

- **Python 3.11+**: Modern Python with async/await
- **FastAPI**: High-performance async web framework
- **PostgreSQL**: Primary database with SQLAlchemy ORM
- **Redis**: Caching and session storage
- **JWT**: Token-based authentication
- **Pydantic**: Data validation and serialization
- **Alembic**: Database migrations
- **Docker**: Containerized deployment

## Project Structure

```
Server/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application entry point
│   ├── api/                    # API endpoints
│   │   ├── __init__.py
│   │   ├── deps.py            # Dependencies and auth
│   │   ├── auth.py            # Authentication endpoints
│   │   ├── projects.py        # Project management
│   │   ├── scripts.py         # Script management
│   │   ├── executions.py      # Test execution
│   │   └── users.py           # User management
│   ├── core/                   # Core application logic
│   │   ├── __init__.py
│   │   ├── config.py          # Configuration settings
│   │   ├── database.py        # Database connection and session
│   │   └── security.py        # Security utilities
│   ├── models/                 # Database models
│   │   ├── __init__.py
│   │   ├── user.py            # User, Team, API Key models
│   │   ├── project.py         # Project, Environment, DataFile models
│   │   ├── script.py          # Script, Schedule, Baseline models
│   │   └── execution.py       # Execution, TestCase, Step models
│   ├── schemas/                # Pydantic schemas
│   │   ├── __init__.py
│   │   ├── user.py            # User-related schemas
│   │   ├── auth.py            # Authentication schemas
│   │   ├── project.py         # Project-related schemas
│   │   ├── script.py          # Script-related schemas
│   │   └── execution.py       # Execution-related schemas
│   ├── services/               # Business logic services
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   ├── user_service.py
│   │   ├── project_service.py
│   │   ├── script_service.py
│   │   └── execution_service.py
│   └── utils/                  # Utility functions
│       ├── __init__.py
│       ├── exceptions.py       # Custom exceptions
│       ├── helpers.py          # Helper functions
│       └── logging.py         # Logging configuration
├── alembic/                    # Database migrations
├── tests/                      # Test suite
│   ├── __init__.py
│   ├── test_api/
│   └── test_services/
├── requirements.txt            # Python dependencies
├── pyproject.toml             # Project configuration
├── Dockerfile                 # Docker container
├── .env.example              # Environment variables template
└── README.md                 # This file
```

## Getting Started

### Prerequisites

- Python 3.11 or higher
- PostgreSQL 13 or higher
- Redis 6 or higher
- Docker and Docker Compose (optional)

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd Server
   ```

2. **Create a virtual environment**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Set up the database**:
   ```bash
   # Create PostgreSQL database
   createdb uitrace_db

   # Run migrations
   alembic upgrade head
   ```

6. **Start the server**:
   ```bash
   uvicorn app.main:app --reload
   ```

### Docker Deployment

1. **Build the image**:
   ```bash
   docker build -t uitrace-server .
   ```

2. **Run with Docker Compose**:
   ```bash
   docker-compose up -d
   ```

## API Documentation

Once the server is running, you can access:

- **Interactive API Docs**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI Schema**: http://localhost:8000/openapi.json

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register a new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout user
- `GET /api/v1/auth/me` - Get current user

### Projects
- `GET /api/v1/projects` - List projects
- `POST /api/v1/projects` - Create project
- `GET /api/v1/projects/{id}` - Get project
- `PUT /api/v1/projects/{id}` - Update project
- `DELETE /api/v1/projects/{id}` - Delete project

### Scripts
- `GET /api/v1/scripts` - List scripts
- `POST /api/v1/scripts` - Create script
- `GET /api/v1/scripts/{id}` - Get script
- `PUT /api/v1/scripts/{id}` - Update script
- `POST /api/v1/scripts/{id}/execute` - Execute script

### Executions
- `GET /api/v1/executions` - List executions
- `GET /api/v1/executions/{id}` - Get execution
- `POST /api/v1/executions/{id}/stop` - Stop execution
- `GET /api/v1/executions/{id}/report` - Get execution report

## Configuration

Key environment variables:

```bash
# Application
APP_NAME="UITrace Server"
DEBUG=false

# Database
DATABASE_URL=postgresql+asyncpg://user:password@localhost/uitrace_db

# Redis
REDIS_URL=redis://localhost:6379/0

# Security
SECRET_KEY=your-super-secret-key
JWT_SECRET_KEY=your-jwt-secret-key

# CORS
BACKEND_CORS_ORIGINS=["http://localhost:3000"]
```

## Development

### Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_api/test_auth.py
```

### Code Quality

```bash
# Format code
black app/

# Sort imports
isort app/

# Type checking
mypy app/

# Linting
flake8 app/
```

### Database Migrations

```bash
# Create new migration
alembic revision --autogenerate -m "Description"

# Apply migrations
alembic upgrade head

# Downgrade migration
alembic downgrade -1
```

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- Documentation: [docs.uitrace.com](https://docs.uitrace.com)
- Issues: [GitHub Issues](https://github.com/uitrace/server/issues)
- Discussions: [GitHub Discussions](https://github.com/uitrace/server/discussions)