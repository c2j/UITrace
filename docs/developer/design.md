# UITrace 开发者文档 - 设计文档

## UITrace 项目设计规范 (Design Specification)

| 项目名称 | UITrace (界面溯) |
| :--- | :--- |
| **版本** | V1.0 - Python/FastAPI Server 版本 |
| **设计者** | Gemini AI |
| **日期** | 2025 年 11 月 28 日 |

-----

### 1\. 引言

#### 1.1 项目目标

UITrace 旨在建立一个高性能、高可靠、数据驱动的端到端 UI 自动化测试平台。通过将高性能的 **Rust** 用于桌面端执行引擎，结合灵活高效的 **Python/FastAPI** 用于服务端协作与数据管理，实现对大规模功能模块（数百个）和测试用例（数千个）的稳定覆盖。

#### 1.2 系统架构概览

系统采用 **客户端-服务器（C/S）** 架构。

  * **客户端 (UITrace Desktop):** 负责录制、容错回放、本地数据处理和结果生成。
  * **服务器 (UITrace Server):** 负责脚本和数据的集中式管理、用户认证、协作以及测试结果的聚合与展示。

-----

### 2\. 技术栈选型与规范

| 模块 | 角色 | 核心技术栈 | 依赖库/框架 | 规范 |
| :--- | :--- | :--- | :--- | :--- |
| **桌面端 (Client)** | 执行引擎 | **Rust / Tauri** | `thirtyfour` (WebDriver), `Tokio`, `csv`, `image`, `image-compare` | 严格遵循 Tauri 最佳实践，核心引擎使用 Rust 异步编程。 |
| **前端 UI** | 用户界面 | Vue 3 / TypeScript | Element Plus / Ant Design Vue | 负责脚本编辑器、结果可视化、截图对比界面。 |
| **服务端 (Server)** | API 与数据管理 | **Python / FastAPI** | `Pydantic`, `SQLAlchemy`, `pandas`, `openpyxl`, `Uvicorn` | 异步 API 设计，所有数据模型使用 Pydantic 校验。 |
| **数据库 (DB)** | 持久化存储 | PostgreSQL | `SQLAlchemy` | 用于存储用户、脚本元数据、测试结果。 |
| **通信协议** | C/S 通信 | RESTful API / WebSocket (可选) | JSON | 所有数据传输使用 HTTPS/TLS 加密。 |

-----

### 3\. 系统架构与分层

#### 3.1 客户端分层 (UITrace Desktop - Rust)

Desktop 应用分为三层：

| 层级 | 职责 | 核心模块 |
| :--- | :--- | :--- |
| **UI 层 (Webview)** | 用户交互、数据展示 | 脚本编辑器、结果仪表盘、截图对比视图。 |
| **核心服务层 (Rust)** | 业务逻辑、与前端/服务端通信 | 录制器 (Recorder)、数据驱动管理器 (DDT Manager)、报告器 (Reporter)。 |
| **驱动层 (Driver)** | 外部设备和浏览器交互 | 回放引擎 (Playback Engine)、`thirtyfour` API、文件 I/O。 |

#### 3.2 服务端分层 (UITrace Server - Python/FastAPI)

Server 应用采用经典三层架构：

| 层级 | 职责 | 关键组件 |
| :--- | :--- | :--- |
| **API 层** | 请求接收、路由分发、数据格式校验 | FastAPI Router, Pydantic Models (Request/Response) |
| **业务逻辑层 (Service)** | 核心业务处理（如权限校验、脚本版本控制） | Python Service Classes |
| **数据访问层 (DAL)** | 数据库操作、文件存储 | SQLAlchemy ORM, PostgreSQL |

-----

### 4\. 模块设计：桌面端 (Desktop Module Design)

#### 4.1 回放引擎 (Playback Engine) - 容错核心

| 功能 | 描述 | 实现细节 |
| :--- | :--- | :--- |
| **会话管理** | 启动和管理 `thirtyfour` WebDriver 会话。 | 使用 `Tokio` 异步执行，确保主线程响应迅速。 |
| **智能轮询** | 处理网络延迟和服务器慢响应。 | 使用 Rust 的 `std::time::Instant` 计时，在设定的 `timeout_seconds` 内持续循环尝试。 |
| **多重选择器** | 处理界面变化。 | 在轮询循环内部，按顺序尝试脚本中提供的所有备选定位符（ID -\> CSS -\> XPath）。只要找到一个可交互元素，立即跳出循环。 |
| **动作执行** | 执行 `click`, `type`, `assert_text` 等动作。 | 封装 `thirtyfour::WebElement` 方法，注入前后置的**元素可交互性**检查 (`is_displayed`, `is_enabled`, `is_clickable`)。 |

#### 4.2 数据驱动管理器 (DDT Manager)

| 功能 | 描述 | 实现细节 |
| :--- | :--- | :--- |
| **数据读取** | 导入 Excel/CSV 数据文件。 | 使用 Rust `csv` crate 或 `calamine` 库，将数据解析为 `Vec<HashMap<String, String>>`。 |
| **占位符替换** | 将数据注入到脚本中。 | 遍历 CSV/Excel 的每一行数据，使用正则表达式或其他高效字符串替换方法，将脚本中所有 `${KeyName}` 替换为当前行对应的值。 |
| **用例隔离** | 确保每个数据行独立执行。 | 引擎的外层主循环以数据行为单位，每次循环重置浏览器状态（可选）并生成独立的报告文件前缀。 |

-----

### 5\. 模块设计：服务端 (Server Module Design)

#### 5.1 身份验证与用户管理

  * **API 协议:** 使用基于 JWT 的身份验证。
  * **登录流程:** 用户 POST 登录信息 -\> FastAPI 验证 -\> 签发带有用户 ID 和角色信息的 JWT Token。
  * **权限:** 使用 FastAPI 依赖注入 (`Depends`) 机制，在关键 API 路由上实施角色权限控制。

#### 5.2 脚本与数据管理 API

| 模块 | 职责 | 关键数据模型 (Pydantic) |
| :--- | :--- | :--- |
| **脚本仓库** | 脚本的 CRUD、版本控制 | `ScriptMetadata` (ID, Name, Version, Creator), `ScriptContent` (JSON string) |
| **数据仓库** | CSV/Excel 文件的上传与下载 | `DataFileMetadata` (ID, Name, Columns, Status) |
| **协作管理** | 脚本锁定/解锁机制 | `LockStatus` (ScriptID, UserID, Timestamp) |

#### 5.3 结果聚合与报告

  * **结果接收:** 接收来自 Desktop 端的 POST 请求，数据包含 `TestCaseID`, `Status` (Pass/Fail), `Duration`, **`VisualDifference` (%)**。
  * **持久化:** 使用 SQLAlchemy 将结果存储在 PostgreSQL 中。
  * **数据可视化:** 提供 API 供前端查询测试覆盖率、历史趋势、模块健康度等统计指标。

-----

### 6\. 核心协议与数据格式

#### 6.1 JSON 脚本规范

脚本必须是序列化的 JSON 数组，每个对象代表一个测试步骤。

```json
{
  "step_id": 42,
  "name": "步骤描述 (可修改)",
  "action": "type", // [navigate, click, type, assert_text, screenshot, assert_url]
  
  // 核心数据：支持 DDT
  "value": "${DataFieldName}", // 或 "硬编码文本"
  "expected_value": "${ExpectedValue}", 
  
  // 核心容错：回放引擎处理
  "timeout_seconds": 20, 
  "selectors": [
    { "type": "css", "value": "input[name='search']" },
    { "type": "xpath", "value": "//div[@id='search-box']//input" }
  ]
}
```

#### 6.2 服务端 API 契约 (FastAPI Routes)

| 功能 | 方法 | Endpoint | 描述 | 关键校验 |
| :--- | :--- | :--- | :--- | :--- |
| **认证** | POST | `/api/v1/auth/login` | 获取 JWT Token | Pydantic (Username, Password) |
| **获取脚本** | GET | `/api/v1/scripts/{id}` | 获取脚本 JSON 内容 | 校验 JWT, 校验脚本 ID |
| **上传脚本** | POST | `/api/v1/scripts/upload` | 上传新脚本或新版本 | Pydantic (ScriptMetadata, Content) |
| **上传数据** | POST | `/api/v1/data/upload` | 上传 CSV/Excel 文件 | `fastapi.File`, 格式校验 |
| **提交结果** | POST | `/api/v1/results/submit` | 提交测试执行报告 | Pydantic (TestCaseID, Status, Duration, VisualDifference) |

-----

### 7\. 部署与运维

  * **容器化:** 推荐使用 **Docker/Docker Compose** 打包整个系统。
      * 一个容器运行 **FastAPI Server**。
      * 一个容器运行 **PostgreSQL DB**。
      * 一个容器运行 **ChromeDriver/GeckoDriver** (供 Rust Desktop 调用)。
  * **客户端分发:** Desktop 应用通过 Tauri 构建为原生的 `.exe` (Windows), `.dmg` (macOS), 或 `.deb` (Linux) 文件进行分发。
  * **监控:** Server 应集成基本的日志和性能监控机制（如 Prometheus/Grafana）。