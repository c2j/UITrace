# Claude 指令

## 当前状态

@CLAUDE.md

## 概述

本仓库用于构建 UITrace 应用，它为项目提供了合理的默认配置。

## 核心规则

### 新会话

- 阅读 `docs/developer/reqirement.md` 了解需求
- 查看 `docs/developer/design.md` 了解关键设计
- 查看 `docs/developer/UI.md` 了解关键界面
- 检查 git 状态和项目结构

### 开发实践

**关键：** 严格遵循以下规则：

1. **编辑前阅读**：始终先阅读文件以理解上下文
2. **遵循既定模式**：使用本文件和 `docs/developer` 中的模式
3. **高级架构师思维**：考虑性能、可维护性、可测试性
4. **批量操作**：在单个响应中使用多个工具调用
5. **匹配代码风格**：遵循现有的格式和模式
6. **测试覆盖**：为业务逻辑编写全面测试
7. **质量门控**：重大更改后运行 `npm run check:all`
8. **无开发服务器**：请用户运行并反馈
9. **阶段性提交**：每完成一个阶段任务后提交并push分支
10. **文档**：为新模式更新相关 `docs/developer/` 文件
11. **删除文件**：始终使用 `rm -f`


**关键：** 仅使用 Tauri v2 文档。始终使用现代 Rust 格式：`format!("{variable}")`

## 架构模式（关键）

Desktop：是UITrace的桌面端，编程语言为Rust，框架主要是Tauri
Server ：是UITrace的服务器端，编程语言为Python，框架主要是FastAPI，与Desktop的交互通过RESTful API接口

### 状态管理洋葱模型

## Active Technologies
- Rust 1.75+ (Desktop), Python 3.11+ (Server), TypeScript 5.0+ (Frontend) + Tauri 2.0, Tokio async runtime, Thirtyfour WebDriver, Vue 3, FastAPI, Pydantic, SQLAlchemy, PostgreSQL (001-uitrace-platform)
- PostgreSQL for structured data, file system for test scripts and screenshots, Redis for session caching (001-uitrace-platform)

## Recent Changes
- 001-uitrace-platform: Added Rust 1.75+ (Desktop), Python 3.11+ (Server), TypeScript 5.0+ (Frontend) + Tauri 2.0, Tokio async runtime, Thirtyfour WebDriver, Vue 3, FastAPI, Pydantic, SQLAlchemy, PostgreSQL
