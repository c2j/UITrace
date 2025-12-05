# UITrace Platform Quickstart Guide

**Date**: 2025-11-27
**Purpose**: Get started with UITrace platform development and deployment

## Prerequisites

### Development Environment

- **Rust**: 1.75.0 or later
- **Python**: 3.11 or later
- **Node.js**: 20.0 or later
- **PostgreSQL**: 15.0 or later
- **Redis**: 7.0 or later
- **Git**: Latest stable version

### Required Tools

- **Tauri CLI**: `cargo install tauri-cli --version "^2.0.0"`
- **Python Poetry**: `curl -sSL https://install.python-poetry.org | python3 -`
- **Docker**: Latest stable version (for development services)

## Project Setup

### 1. Clone Repository

```bash
git clone <repository-url>
cd UITrace
```

### 2. Environment Configuration

Create environment files:

```bash
# Create .env files
cp desktop/.env.example desktop/.env
cp server/.env.example server/.env
```

**Desktop .env**:
```env
# API Configuration
VITE_API_BASE_URL=http://localhost:8000/v1
VITE_WS_URL=ws://localhost:8000/ws

# Application
TAURI_DEV_HOST=localhost
TAURI_BUNDLE_IDENTIFIER=dev.uitrace.desktop
```

**Server .env**:
```env
# Database
DATABASE_URL=postgresql://uitrace:password@localhost:5432/uitrace_dev
REDIS_URL=redis://localhost:6379/0

# Authentication
JWT_SECRET_KEY=your-super-secret-jwt-key-here
REFRESH_TOKEN_SECRET=your-super-secret-refresh-key-here
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7

# OAuth Providers
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
MICROSOFT_CLIENT_ID=your-microsoft-client-id
MICROSOFT_CLIENT_SECRET=your-microsoft-client-secret

# File Storage
UPLOAD_DIR=./storage
MAX_FILE_SIZE_MB=100

# CORS
ALLOWED_ORIGINS=["http://localhost:3000", "http://localhost:1420", "app://localhost"]

# Logging
LOG_LEVEL=INFO
```

### 3. Database Setup

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Run database migrations
cd server
poetry install
poetry run alembic upgrade head

# Create admin user
poetry run python scripts/create_admin.py
```

### 4. Development Services

Start all required services:

```bash
# In one terminal - start server
cd server
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# In another terminal - start desktop client
cd desktop
npm install
npm run tauri dev
```

## Development Workflow

### 1. Create Your First Test Script

```bash
# Using the desktop client:
# 1. Click "Start Recording"
# 2. Navigate to a web page
# 3. Perform actions (click, type, navigate)
# 4. Click "Stop Recording"
# 5. Edit and save the script
```

### 2. Execute Test Script

```bash
# Via desktop client:
# 1. Select a script
# 2. Choose browser type (Chrome, Firefox, Edge)
# 3. Click "Execute"
# 4. Monitor execution in real-time
# 5. Review results and screenshots
```

### 3. Data-Driven Testing

```bash
# Create a CSV file (test_data.csv):
username,password
user1,password1
user2,password2

# Upload to project:
# 1. Go to Data Files tab
# 2. Upload test_data.csv
# 3. Link to script
# 4. Execute with data-driven mode
```

## API Examples

### Authentication

```python
import requests

# Login
response = requests.post('http://localhost:8000/v1/auth/login', json={
    'email': 'admin@example.com',
    'password': 'adminpassword'
})
token = response.json()['accessToken']

# Use token for authenticated requests
headers = {'Authorization': f'Bearer {token}'}
```

### Create Project

```python
# Create team
team_response = requests.post(
    'http://localhost:8000/v1/teams',
    json={'name': 'QA Team', 'description': 'Quality assurance'},
    headers=headers
)
team_id = team_response.json()['id']

# Create project
project_response = requests.post(
    'http://localhost:8000/v1/projects',
    json={
        'name': 'E-commerce Tests',
        'description': 'Automated tests for e-commerce platform',
        'teamId': team_id
    },
    headers=headers
)
project_id = project_response.json()['id']
```

### Upload Test Script

```python
import json

script_data = {
    "name": "Login Test",
    "description": "Test user login flow",
    "scriptContent": [
        {
            "stepId": 1,
            "name": "Navigate to login page",
            "action": "navigate",
            "value": "https://example.com/login",
            "selectors": [{"type": "css", "value": "body"}],
            "timeoutSeconds": 10
        },
        {
            "stepId": 2,
            "name": "Enter username",
            "action": "type",
            "value": "${username}",
            "selectors": [
                {"type": "id", "value": "username"},
                {"type": "css", "value": "input[name='username']"},
                {"type": "xpath", "value": "//input[@id='username']"}
            ],
            "timeoutSeconds": 5
        },
        {
            "stepId": 3,
            "name": "Enter password",
            "action": "type",
            "value": "${password}",
            "selectors": [
                {"type": "id", "value": "password"},
                {"type": "css", "value": "input[name='password']"},
                {"type": "xpath", "value": "//input[@id='password']"}
            ],
            "timeoutSeconds": 5
        },
        {
            "stepId": 4,
            "name": "Click login button",
            "action": "click",
            "selectors": [
                {"type": "id", "value": "login-btn"},
                {"type": "css", "value": "button[type='submit']"},
                {"type": "xpath", "value": "//button[text()='Login']"}
            ],
            "timeoutSeconds": 5
        },
        {
            "stepId": 5,
            "name": "Verify login success",
            "action": "assert_url",
            "value": "https://example.com/dashboard",
            "selectors": [{"type": "css", "value": "body"}],
            "timeoutSeconds": 10
        }
    ]
}

response = requests.post(
    f'http://localhost:8000/v1/projects/{project_id}/scripts',
    json=script_data,
    headers=headers
)
script_id = response.json()['id']
```

### Execute Test

```python
# Start execution
execution_response = requests.post(
    'http://localhost:8000/v1/executions',
    json={
        'scriptId': script_id,
        'executionName': 'Daily Login Test',
        'browserType': 'chrome',
        'executionMode': 'sequential'
    },
    headers=headers
)
execution_id = execution_response.json()['id']

# Monitor execution
execution = requests.get(
    f'http://localhost:8000/v1/executions/{execution_id}',
    headers=headers
).json()

print(f"Status: {execution['status']}")
print(f"Duration: {execution['totalDurationMs']}ms")
```

## Testing

### Running Tests

```bash
# Server tests
cd server
poetry run pytest tests/

# Desktop tests
cd desktop
npm run test
cargo test

# End-to-end tests
npm run test:e2e
```

### Test Coverage

```bash
# Server coverage
cd server
poetry run pytest --cov=app tests/

# Desktop coverage
cd desktop
npm run test:coverage
```

## Deployment

### Docker Deployment

```bash
# Build and deploy all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Production Build

```bash
# Build desktop client
cd desktop
npm run tauri build

# Build and run server
cd server
poetry build
poetry run gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker
```

## Troubleshooting

### Common Issues

1. **WebDriver not found**:
   ```bash
   # Install ChromeDriver
   brew install chromedriver  # macOS
   sudo apt-get install chromium-chromedriver  # Ubuntu
   ```

2. **Database connection failed**:
   ```bash
   # Check PostgreSQL status
   docker-compose ps postgres

   # Reset database
   docker-compose exec postgres psql -U uitrace -c "DROP DATABASE IF EXISTS uitrace_dev; CREATE DATABASE uitrace_dev;"
   ```

3. **CORS errors**:
   ```bash
   # Update ALLOWED_ORIGINS in server/.env
   # Ensure frontend URL is included
   ```

4. **File upload failures**:
   ```bash
   # Check storage directory permissions
   mkdir -p storage/scripts storage/data storage/screenshots
   chmod 755 storage
   ```

### Debug Mode

Enable debug logging:

```bash
# Server
export LOG_LEVEL=DEBUG
poetry run uvicorn app.main:app --reload --log-level debug

# Desktop
export RUST_LOG=debug
npm run tauri dev
```

## Resources

- **Documentation**: `/docs`
- **API Reference**: `http://localhost:8000/docs` (when server is running)
- **Architecture Guide**: `/docs/architecture/README.md`
- **Contributing Guide**: `/CONTRIBUTING.md`

## Getting Help

- **Discord**: [UITrace Discord Server](https://discord.gg/uitrace)
- **GitHub Issues**: [Report bugs and request features](https://github.com/uitrace/platform/issues)
- **Email**: support@uitrace.dev