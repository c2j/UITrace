# UITrace Quickstart Guide

**Version**: 1.0.0
**Date**: 2025-11-30
**Purpose**: Get started with UITrace UI automation testing platform

## Overview

UITrace is a high-performance, data-driven UI automation testing platform that combines a Rust-based desktop client with a Python/FastAPI server backend. This guide will help you set up your development environment and create your first automated test.

## Prerequisites

### Development Environment

- **Rust**: 1.75 or later
- **Python**: 3.11 or later
- **Node.js**: 18 or later (for frontend development)
- **Docker**: Latest version (for local development environment)
- **Git**: Latest version

### System Requirements

- **Operating System**: Windows 10+, macOS 10.15+, or Linux (Ubuntu 20.04+)
- **RAM**: 8GB minimum, 16GB recommended
- **Storage**: 5GB free space for development setup
- **Browser**: Chrome 90+, Firefox 90+, Safari 14+, or Edge 90+

## Quick Installation

### 1. Clone Repository

```bash
git clone https://github.com/your-org/uitrace.git
cd uitrace
```

### 2. Setup Development Environment with Docker

```bash
# Copy environment configuration
cp .env.example .env

# Start development services
docker-compose -f docker-compose.dev.yml up -d

# Install dependencies
./scripts/install-dependencies.sh
```

### 3. Initialize Database

```bash
# Run database migrations
./scripts/setup-database.sh

# Create initial admin user
./scripts/create-admin-user.sh
```

### 4. Build Desktop Application

```bash
# Navigate to client directory
cd desktop-client

# Install Rust dependencies
cargo build

# Install frontend dependencies
cd src-ui
npm install
npm run build

# Return to root and build Tauri application
cd ../..
cargo tauri dev
```

## Your First Test

### Step 1: Create a New Script

1. **Launch UITrace Desktop Application**
   ```bash
   cargo tauri dev
   ```

2. **Create New Project**
   - Click "New Project" in the dashboard
   - Enter project name: "My First Project"
   - Click "Create"

3. **Start Recording**
   - Click "New Script" button
   - Enter script name: "Login Test"
   - Click "Start Recording"

### Step 2: Record User Actions

1. **Browser Launch**
   - UITrace will automatically open Chrome in debug mode
   - Navigate to your target application

2. **Record Login Flow**
   - Enter username: `testuser@example.com`
   - Enter password: `password123`
   - Click "Login" button
   - Wait for dashboard to load

3. **Add Validation**
   - Right-click on welcome message
   - Select "Add Assertion" → "Assert Text Visible"
   - Enter expected text: "Welcome, Test User"

4. **Stop Recording**
   - Click "Stop Recording" in UITrace
   - Save the script

### Step 3: Add Data-Driven Testing

1. **Create Test Data**
   ```csv
   username,password,expected_message
   testuser@example.com,password123,Welcome, Test User
   admin@example.com,admin123,Welcome, Admin
   user@example.com,user123,Welcome, User
   ```

2. **Upload Data File**
   - Click "Data Files" tab
   - Click "Upload Data"
   - Select your CSV file
   - Name it: "login_data.csv"

3. **Modify Script**
   - Open your recorded script
   - Replace hardcoded values with placeholders:
     - Username: `${username}`
     - Password: `${password}`
     - Expected text: `${expected_message}`
   - Link the script to "login_data.csv"

### Step 4: Run Your Test

1. **Single Execution**
   - Click "Run Script" button
   - Select data file: "login_data.csv"
   - Choose execution options:
     - Browser: Chrome
     - Headless: No (for visual debugging)
   - Click "Start Execution"

2. **Monitor Results**
   - Watch real-time execution progress
   - View step-by-step results
   - Check screenshots for each step

3. **Review Results**
   - Execution should complete with all 3 data rows
   - Each row should show "PASSED" status
   - Visual comparisons should show 0% difference

## Development Setup

### Server Development

```bash
# Navigate to server directory
cd server

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Run development server
uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# Access API documentation
open http://localhost:8000/docs
```

### Client Development

```bash
# Navigate to client directory
cd desktop-client

# Development mode with hot reload
cargo tauri dev

# Build for production
cargo tauri build

# Run tests
cargo test

# Run with logging
RUST_LOG=debug cargo tauri dev
```

### Frontend Development

```bash
# Navigate to frontend directory
cd desktop-client/src-ui

# Development mode
npm run dev

# Build for production
npm run build

# Run tests
npm run test

# Lint and format
npm run lint
npm run format
```

## API Testing

### Authentication

```bash
# Login and get token
curl -X POST http://localhost:8000/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Use token for authenticated requests
curl -X GET http://localhost:8000/v1/projects \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Script Management

```bash
# Create new script
curl -X POST http://localhost:8000/v1/scripts \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test Script",
    "description": "Created via API",
    "content": "[{\"step_id\": 1, \"name\": \"Navigate\", \"action\": \"navigate\", \"value\": \"https://example.com\", \"selectors\": [{\"type\": \"css\", \"value\": \"body\", \"priority\": 1}]}]"
  }'
```

## Common Use Cases

### 1. Web Application Testing

```json
{
  "step_id": 1,
  "name": "Navigate to Login Page",
  "action": "navigate",
  "value": "https://app.example.com/login",
  "selectors": [{"type": "css", "value": "body", "priority": 1}]
},
{
  "step_id": 2,
  "name": "Enter Username",
  "action": "type",
  "value": "${username}",
  "selectors": [
    {"type": "id", "value": "username-input", "priority": 1},
    {"type": "css", "value": "input[name='username']", "priority": 2},
    {"type": "xpath", "value": "//input[@id='username-input']", "priority": 3}
  ]
}
```

### 2. Visual Regression Testing

```json
{
  "step_id": 5,
  "name": "Capture Dashboard Screenshot",
  "action": "screenshot",
  "selectors": [{"type": "css", "value": ".dashboard", "priority": 1}]
},
{
  "step_id": 6,
  "name": "Assert Visual No Changes",
  "action": "assert_visible",
  "value": "dashboard-baseline",
  "selectors": [{"type": "css", "value": ".dashboard", "priority": 1}]
}
```

### 3. Form Validation Testing

```json
{
  "step_id": 3,
  "name": "Test Invalid Email",
  "action": "type",
  "value": "invalid-email",
  "selectors": [{"type": "css", "value": "#email", "priority": 1}]
},
{
  "step_id": 4,
  "name": "Submit Form",
  "action": "click",
  "selectors": [{"type": "css", "value": "#submit-button", "priority": 1}]
},
{
  "step_id": 5,
  "name": "Verify Error Message",
  "action": "assert_text",
  "value": "Please enter a valid email address",
  "selectors": [{"type": "css", "value": ".error-message", "priority": 1}]
}
```

## Configuration

### Environment Variables

Create `.env` file in project root:

```bash
# Server Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/uitrace
SECRET_KEY=your-secret-key-here
CORS_ORIGINS=http://localhost:3000,http://localhost:1420

# Client Configuration
API_BASE_URL=http://localhost:8000/v1
DEFAULT_BROWSER=chrome
DEFAULT_TIMEOUT=15000

# File Storage
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=104857600
ALLOWED_FILE_TYPES=csv,xlsx,xls

# Logging
LOG_LEVEL=info
LOG_FILE=./logs/uitrace.log
```

### Browser Configuration

```bash
# Chrome setup
export CHROME_BINARY="/usr/bin/google-chrome"
export CHROMEDRIVER_PATH="/usr/local/bin/chromedriver"

# Firefox setup
export FIREFOX_BINARY="/usr/bin/firefox"
export GECKODRIVER_PATH="/usr/local/bin/geckodriver"
```

## Troubleshooting

### Common Issues

1. **Browser Driver Not Found**
   ```bash
   # Install drivers using webdriver-manager
   pip install webdriver-manager
   python -m webdriver_manager chrome
   ```

2. **Database Connection Failed**
   ```bash
   # Check PostgreSQL status
   docker-compose -f docker-compose.dev.yml ps
   docker-compose -f docker-compose.dev.yml logs db
   ```

3. **Permission Denied on Screenshots**
   ```bash
   # Linux: Add user to appropriate groups
   sudo usermod -a -G audio,video $USER

   # macOS: Grant screen recording permissions
   # System Preferences → Security & Privacy → Privacy → Screen Recording
   ```

4. **Memory Usage High**
   ```bash
   # Limit browser instances
   export UITRACE_MAX_CONCURRENT_EXECUTIONS=2

   # Use headless mode
   # In UI: Settings → Execution → Headless Mode: Enabled
   ```

### Debug Mode

Enable detailed logging:

```bash
# Client debug mode
RUST_LOG=debug cargo tauri dev

# Server debug mode
LOG_LEVEL=debug uvicorn src.main:app --reload

# Enable browser debugging
export UITRACE_BROWSER_DEBUG=true
```

## Next Steps

1. **Explore Advanced Features**
   - Visual regression testing
   - CI/CD integration
   - Team collaboration
   - Custom assertions

2. **Read Documentation**
   - [Script Writing Guide](../docs/script-writing.md)
   - [API Reference](../docs/api-reference.md)
   - [Deployment Guide](../docs/deployment.md)

3. **Join Community**
   - [GitHub Discussions](https://github.com/your-org/uitrace/discussions)
   - [Discord Server](https://discord.gg/uitrace)
   - [Stack Overflow Tag](https://stackoverflow.com/questions/tagged/uitrace)

4. **Contribute to Project**
   - Report issues on [GitHub Issues](https://github.com/your-org/uitrace/issues)
   - Submit pull requests
   - Contribute to documentation

## Support

- **Documentation**: [docs.uitrace.com](https://docs.uitrace.com)
- **Support Email**: support@uitrace.com
- **Status Page**: [status.uitrace.com](https://status.uitrace.com)
- **GitHub Issues**: [github.com/your-org/uitrace/issues](https://github.com/your-org/uitrace/issues)