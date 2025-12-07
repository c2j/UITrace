# UITrace Desktop Client Makefile
# T005: Setup code quality tools and build automation

.PHONY: help check fmt clippy test build clean install dev

# 默认目标
help:
	@echo "UITrace Desktop Client - Available targets:"
	@echo "  check     - Run all code quality checks (fmt + clippy)"
	@echo "  fmt       - Format code using rustfmt"
	@echo "  clippy    - Run clippy linter"
	@echo "  test      - Run all tests"
	@echo "  build     - Build the application"
	@echo "  dev       - Start development mode"
	@echo "  clean     - Clean build artifacts"
	@echo "  install   - Install dependencies"

# 代码质量检查
check: fmt clippy
	@echo "✅ All code quality checks passed"

fmt:
	@echo "🔧 Formatting Rust code..."
	cargo fmt --all -- --check || cargo fmt --all
	@echo "✅ Code formatting complete"

clippy:
	@echo "🔍 Running clippy linter..."
	cargo clippy --all-targets --all-features -- -D warnings
	@echo "✅ Clippy checks passed"

# 测试
test:
	@echo "🧪 Running tests..."
	cargo test --all-features
	@echo "✅ Tests complete"

# 构建
build:
	@echo "🔨 Building application..."
	cargo build --release
	@echo "✅ Build complete"

# 开发模式
dev:
	@echo "🚀 Starting development server..."
	cargo tauri dev

# 清理
clean:
	@echo "🧹 Cleaning build artifacts..."
	cargo clean
	@echo "✅ Clean complete"

# 安装依赖
install:
	@echo "📦 Installing dependencies..."
	cargo fetch
	@echo "✅ Dependencies installed"

# 预提交钩子
pre-commit:
	@echo "🎯 Running pre-commit checks..."
	cargo fmt --all -- --check
	cargo clippy --all-targets --all-features -- -D warnings
	cargo test --all-features
	@echo "✅ Pre-commit checks passed"

# CI/CD集成
ci-check: fmt clippy test
	@echo "🔄 CI pipeline checks complete"

# 发布版本
release: clean check test build
	@echo "🚀 Release build complete"
	@echo "📦 Binary available at: target/release/uitrace-client"

# 代码覆盖率
coverage:
	@echo "📊 Generating code coverage report..."
	cargo tarpaulin --out Html
	@echo "📄 Coverage report available at: target/tarpaulin-report.html"

# 文档
docs:
	@echo "📚 Generating documentation..."
	cargo doc --no-deps --open
	@echo "✅ Documentation generated"

# 安全扫描
security:
	@echo "🔒 Running security scan..."
	cargo audit
	@echo "✅ Security scan complete"

# 性能基准测试
benchmark:
	@echo "⚡ Running performance benchmarks..."
	cargo bench
	@echo "✅ Benchmarks complete"

# 所有检查（完整CI流程）
all: install check test security
	@echo "🎉 All checks passed! Ready for development."

# 快速开发检查
quick: fmt clippy
	@echo "⚡ Quick checks complete"

# 帮助信息作为默认目标
.DEFAULT_GOAL := help