# UITrace Server Makefile
# T005: Setup code quality tools and build automation

.PHONY: help install dev test lint format check clean migrate run docker-build docker-run

# 默认目标
help:
	@echo "UITrace Server - Available targets:"
	@echo "  install      - Install dependencies and setup development environment"
	@echo "  dev          - Start development server with hot reload"
	@echo "  test         - Run all tests"
	@echo "  lint         - Run code linting (flake8, mypy)"
	@echo "  format       - Format code (black, isort)"
	@echo "  check        - Run all code quality checks"
	@echo "  migrate      - Run database migrations"
	@echo "  run          - Start production server"
	@echo "  clean        - Clean cache and temporary files"
	@echo "  docker-build - Build Docker image"
	@echo "  docker-run   - Run with Docker Compose"
	@echo "  pre-commit   - Run pre-commit hooks"

# 安装依赖
install:
	@echo "📦 Installing Python dependencies..."
	pip install -e .
	pip install -e .[dev]
	@echo "🎯 Installing pre-commit hooks..."
	pre-commit install
	@echo "✅ Installation complete"

# 开发服务器
dev:
	@echo "🚀 Starting development server..."
	uvicorn main:app --reload --host 0.0.0.0 --port 8000 --log-level debug

# 测试
test:
	@echo "🧪 Running tests..."
	pytest tests/ -v --cov=src --cov-report=term-missing --cov-report=html
	@echo "✅ Tests complete"

test-unit:
	@echo "🧪 Running unit tests..."
	pytest tests/unit/ -v

test-integration:
	@echo "🔗 Running integration tests..."
	pytest tests/integration/ -v

# 代码质量检查
lint:
	@echo "🔍 Running flake8..."
	flake8 src/ tests/
	@echo "🔍 Running mypy..."
	mypy src/
	@echo "🔍 Running bandit security check..."
	bandit -r src/ -f json
	@echo "✅ Linting complete"

format:
	@echo "🔧 Formatting code with black..."
	black src/ tests/
	@echo "🔧 Sorting imports with isort..."
	isort src/ tests/
	@echo "✅ Formatting complete"

check: format lint
	@echo "✅ All code quality checks passed"

# 数据库操作
migrate:
	@echo "🔄 Running database migrations..."
	alembic upgrade head
	@echo "✅ Migrations complete"

migrate-create:
	@echo "📝 Creating new migration..."
	alembic revision --autogenerate -m "$(message)"

migrate-downgrade:
	@echo "⬇️  Downgrading database..."
	alembic downgrade -1

# 生产运行
run:
	@echo "🚀 Starting production server..."
	uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4

# 清理
clean:
	@echo "🧹 Cleaning cache and temporary files..."
	find . -type d -name __pycache__ -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.coverage" -delete
	rm -rf .pytest_cache/
	rm -rf htmlcov/
	rm -rf .mypy_cache/
	rm -rf dist/
	rm -rf build/
	rm -rf *.egg-info/
	@echo "✅ Cleanup complete"

# Docker操作
docker-build:
	@echo "🐳 Building Docker image..."
	docker build -t uitrace-server:latest .
	@echo "✅ Docker build complete"

docker-run:
	@echo "🐳 Running with Docker Compose..."
	docker-compose up -d
	@echo "✅ Docker containers started"

docker-stop:
	@echo "🛑 Stopping Docker containers..."
	docker-compose down
	@echo "✅ Docker containers stopped"

# 预提交钩子
pre-commit:
	@echo "🎯 Running pre-commit checks..."
	pre-commit run --all-files
	@echo "✅ Pre-commit checks complete"

# API文档
docs:
	@echo "📚 Generating API documentation..."
	python -m http.server 8080 --directory htmlcov/ &
	@echo "📄 API docs available at: http://localhost:8080"

# 性能基准测试
benchmark:
	@echo "⚡ Running performance benchmarks..."
	python -m pytest tests/benchmark/ -v
	@echo "✅ Benchmarks complete"

# 安全扫描
security:
	@echo "🔒 Running security scan..."
	bandit -r src/ -f json -o security-report.json
	@echo "📄 Security report: security-report.json"

# 代码覆盖率
coverage:
	@echo "📊 Generating code coverage report..."
	pytest tests/ --cov=src --cov-report=html --cov-report=term-missing
	@echo "📄 Coverage report: htmlcov/index.html"

# 数据库重置
reset-db:
	@echo "🔄 Resetting database..."
	docker-compose down -v
	docker-compose up -d db redis
	@echo "⏳ Waiting for database to be ready..."
	sleep 10
	alembic upgrade head
	@echo "✅ Database reset complete"

# 环境检查
check-env:
	@echo "🔍 Checking environment..."
	@python --version
	@pip --version
	@which docker || echo "Docker not found"
	@which docker-compose || echo "Docker Compose not found"
	@echo "✅ Environment check complete"

# 快速检查（开发用）
quick: format lint
	@echo "⚡ Quick checks complete"

# 完整CI流程
ci: check test coverage security
	@echo "🔄 CI pipeline complete"

# 发布版本
release: clean check test
	@echo "🚀 Release build complete"
	@echo "📦 Ready for deployment"

# 所有检查（完整流程）
all: install check test coverage security
	@echo "🎉 All checks passed! Ready for production."

# 帮助信息作为默认目标
.DEFAULT_GOAL := help