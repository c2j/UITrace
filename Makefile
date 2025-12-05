# UITrace Platform - Development Makefile

.PHONY: help install install-desktop install-server install-all dev dev-desktop dev-server build build-desktop build-server test test-desktop test-server lint lint-desktop lint-server format format-desktop format-server clean clean-all check-all

# Default target
help:
	@echo "UITrace Platform Development Commands"
	@echo "======================================"
	@echo ""
	@echo "Installation:"
	@echo "  install         - Install all dependencies"
	@echo "  install-desktop - Install desktop dependencies only"
	@echo "  install-server  - Install server dependencies only"
	@echo ""
	@echo "Development:"
	@echo "  dev             - Start all development servers"
	@echo "  dev-desktop     - Start desktop development server"
	@echo "  dev-server      - Start server development server"
	@echo ""
	@echo "Building:"
	@echo "  build           - Build all components"
	@echo "  build-desktop   - Build desktop application"
	@echo "  build-server    - Build server application"
	@echo ""
	@echo "Testing:"
	@echo "  test            - Run all tests"
	@echo "  test-desktop    - Run desktop tests"
	@echo "  test-server     - Run server tests"
	@echo ""
	@echo "Code Quality:"
	@echo "  lint            - Run all linters"
	@echo "  lint-desktop    - Run desktop linters"
	@echo "  lint-server     - Run server linters"
	@echo "  format          - Format all code"
	@echo "  format-desktop  - Format desktop code"
	@echo "  format-server   - Format server code"
	@echo "  check-all       - Run all quality checks"
	@echo ""
	@echo "Maintenance:"
	@echo "  clean           - Clean all build artifacts"
	@echo "  clean-all       - Deep clean all artifacts and dependencies"

# Installation targets
install-all: install-desktop install-server

install-desktop:
	@echo "Installing desktop dependencies..."
	cd Desktop && bun install
	@echo "Installing Rust dependencies..."
	cd Desktop/uitrace-desktop && cargo fetch

install-server:
	@echo "Installing server dependencies..."
	cd Server && pip install -r requirements.txt

install: install-all

# Development targets
dev: dev-desktop dev-server
	@echo "All development servers started!"
	@echo "Desktop: http://localhost:3000"
	@echo "Server: http://localhost:8000"

dev-desktop:
	@echo "Starting desktop development server..."
	cd Desktop && bun run dev

dev-server:
	@echo "Starting server development server..."
	cd Server && python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Build targets
build: build-desktop build-server

build-desktop:
	@echo "Building desktop application..."
	cd Desktop && bun run generate
	cd Desktop && bun run tauri:build

build-server:
	@echo "Building server application..."
	cd Server && python -m build

# Testing targets
test: test-desktop test-server

test-desktop:
	@echo "Running desktop tests..."
	cd Desktop/uitrace-desktop && cargo test
	cd Desktop && bun run test

test-server:
	@echo "Running server tests..."
	cd Server && python -m pytest tests/ -v --cov=app --cov-report=term-missing

# Linting targets
lint: lint-desktop lint-server

lint-desktop:
	@echo "Linting desktop code..."
	cd Desktop && bun run lint:check
	cd Desktop/uitrace-desktop && cargo clippy -- -D warnings

lint-server:
	@echo "Linting server code..."
	cd Server && flake8 app/
	cd Server && black --check app/
	cd Server && mypy app/

# Formatting targets
format: format-desktop format-server

format-desktop:
	@echo "Formatting desktop code..."
	cd Desktop && bun run format
	cd Desktop/uitrace-desktop && cargo fmt

format-server:
	@echo "Formatting server code..."
	cd Server && black app/
	cd Server && isort app/

# Quality checks
check-all:
	@echo "Running all quality checks..."
	cd Desktop && bun run check:all
	cd Server && flake8 app/ && black --check app/ && mypy app/

check-fix:
	@echo "Fixing all code quality issues..."
	cd Desktop && bun run check:fix
	cd Server && black app/ && isort app/

# Maintenance targets
clean:
	@echo "Cleaning build artifacts..."
	rm -rf Desktop/dist
	rm -rf Desktop/.nuxt
	rm -rf Desktop/.output
	rm -rf Desktop/uitrace-desktop/target
	rm -rf Server/build
	rm -rf Server/dist
	rm -rf Server/*.egg-info
	rm -rf .pytest_cache
	rm -rf .coverage
	rm -rf htmlcov

clean-all: clean
	@echo "Deep cleaning all artifacts and dependencies..."
	rm -rf Desktop/node_modules
	rm -rf Desktop/bun.lockb
	rm -rf Server/.venv
	rm -rf Server/__pycache__
	rm -rf Server/app/__pycache__
	find . -name "*.pyc" -delete
	find . -name "__pycache__" -type d -exec rm -rf {} +

# Docker targets
docker-up:
	@echo "Starting Docker services..."
	docker-compose up -d

docker-down:
	@echo "Stopping Docker services..."
	docker-compose down

docker-logs:
	@echo "Viewing Docker logs..."
	docker-compose logs -f

# Database targets
db-init:
	@echo "Initializing database..."
	cd Server && alembic upgrade head

db-migrate:
	@echo "Creating new migration..."
	cd Server && alembic revision --autogenerate -m "$(message)"

db-upgrade:
	@echo "Upgrading database..."
	cd Server && alembic upgrade head

db-downgrade:
	@echo "Downgrading database..."
	cd Server && alembic downgrade -1

# Utility targets
check-deps:
	@echo "Checking for outdated dependencies..."
	cd Desktop && bun outdated
	cd Server && pip list --outdated

update-deps:
	@echo "Updating dependencies..."
	cd Desktop && bun update
	cd Server && pip install --upgrade pip && pip install --upgrade -r requirements.txt

# CI/CD targets
ci-lint:
	@echo "Running CI linting..."
	make lint
	make check-all

ci-test:
	@echo "Running CI tests..."
	make test

ci-build:
	@echo "Running CI build..."
	make build

# Development shortcuts
lint-fix: check-fix
fmt: format
dev-d: dev-desktop
dev-s: dev-server
test-d: test-desktop
test-s: test-server