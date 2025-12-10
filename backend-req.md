# UITrace Backend Requirement Specification

## 1. Overview
This document defines the backend functional requirements for the **UITrace Web Console**. The backend must provide a RESTful API implementing the `openapi.yaml` specification and support the real-time, data-driven nature of the frontend dashboard, script editor, and execution reports.

The backend acts as the central orchestrator between the **Web Client**, **Database**, **File Storage**, and **Execution Nodes (Agents)**.

---

## 2. Core Functional Modules

### 2.1 Project & Test Management Service
**Goal:** Manage the hierarchy of Projects > Versions > Modules > Scripts.

*   **Data Structure:**
    *   **Project:** Root entity (Name, Icon).
    *   **Version:** Semantic versioning (v1.0, v1.1). Must support status states (`active`, `archived`, `draft`).
    *   **Module:** Logical grouping of scripts. Must support **Inheritance** (e.g., v1.1 inherits "Search Module" from v1.0).
*   **Business Logic:**
    *   **Stats Aggregation:** On every test run completion, asynchronously recalculate `passRate`, `coverage`, and `totalScripts` for the associated Project Version.
    *   **Inheritance Resolution:** When querying a Version, if a module is "inherited", the backend must transparently fetch the scripts from the parent version unless overridden.

### 2.2 Script Orchestration Service
**Goal:** specific Create, Read, Update, Delete (CRUD) for test cases and execution triggers.

*   **Script Storage:**
    *   Store scripts as structured JSON objects (Steps, Actions, Locators).
    *   **Smart Locators:** Store multiple selector strategies per element (ID, CSS, XPath) with priority ranks.
*   **Execution Trigger (`POST /scripts/{id}/run`):**
    *   **Immediate Mode:** Direct request to run a single script.
    *   **Job Queue:** Push the execution request to a high-priority queue (Redis/RabbitMQ) to be picked up by an available Node.
    *   **Response:** Return an `executionId` immediately (Async pattern).

### 2.3 Execution Engine (The "Runner")
**Goal:** Interface with physical/virtual nodes to execute browser automation.

*   **Agent Communication:**
    *   Implement a secure communication channel (WebSocket or HTTP Polling) with **Execution Nodes**.
    *   **Capabilities Matching:** Dispatch jobs based on requirements (e.g., if Script requires "Safari", send to Mac Node).
*   **Runtime Handling:**
    *   **Timeouts:** Enforce `globalTimeout` and `pageLoadTimeout` defined in System Settings.
    *   **Self-Healing:** If the primary locator fails, the Runner must try secondary locators and report the "Healed" status back to the backend.
    *   **Artifact Capture:** The backend must accept uploads from agents:
        *   Step-by-step screenshots.
        *   Console logs (stdout/stderr).
        *   Network HAR files.
        *   Binary Trace files (Playwright trace.zip).

### 2.4 Analysis & Visual Regression Service
**Goal:** Process test results and perform image comparison.

*   **Visual Diff Engine:**
    *   **Baseline Management:** Store "Baseline" images per Script + Browser + Viewport.
    *   **Comparison Logic:** When a test step of type `SCREENSHOT` runs:
        1.  Fetch existing Baseline image.
        2.  Compare with incoming Actual image using a pixel-match algorithm.
        3.  Calculate `diffPercentage`.
        4.  If `diff > tolerance`, mark step as **FAIL**.
    *   **Accept Baseline:** API endpoint to overwrite the old Baseline with the new Actual image.
*   **Log Parsing:**
    *   Ingest raw logs and classify them (INFO, DEBUG, ERROR).
    *   Detect "Root Cause" patterns (e.g., "Element not interactable", "Timeout") for the UI summary.

### 2.5 Infrastructure Manager
**Goal:** Monitor and control Server Nodes.

*   **Heartbeat Monitor:**
    *   Endpoint for Nodes to report status (`ONLINE`, `BUSY`, `OFFLINE`), CPU/RAM usage, and active sessions every X seconds.
    *   Auto-mark nodes as `OFFLINE` if heartbeat is missed.
*   **Remote Control:**
    *   Send commands (`restart`, `shutdown`, `update_agent`) to nodes via the established command channel.

### 2.6 System Configuration
**Goal:** Global settings management.

*   **Persistence:** Store configuration for:
    *   Retry policies (0-3 retries).
    *   Retention policies (e.g., "Delete logs older than 30 days").
*   **Integrations:**
    *   **SMTP:** Send email summaries on scheduled run completion.
    *   **Slack:** Send Webhook notifications on specific events (e.g., "Regression Suite Failed").

---

## 3. Data Storage Requirements

| Data Type | Recommended Storage | Description |
| :--- | :--- | :--- |
| **Relational Data** | PostgreSQL / MySQL | Projects, Users, Metadata, Test Results, Config. |
| **Object Storage** | S3 / MinIO | Screenshots, Baseline Images, PDF Reports, Trace Zips. |
| **Job Queue** | Redis / RabbitMQ | Managing pending test executions. |
| **Time Series** | InfluxDB (Optional) | Long-term history of Node CPU/RAM usage (if advanced monitoring needed). |

---

## 4. API & Interface Constraints

1.  **Strict OpenAPI 3.0 Compliance:** The backend must validate all requests and responses against the provided `openapi.yaml`.
2.  **Pagination:** All list endpoints (`/executions`, `/logs`) must support `limit` and `offset` (or cursor-based pagination).
3.  **Error Handling:** Return standard HTTP status codes (400, 401, 404, 500) with descriptive JSON error messages.
4.  **Performance:**
    *   Dashboard Stats API must respond in < 200ms.
    *   Log ingestion must handle high throughput (e.g., 100 lines/sec per active node).

## 5. Security Requirements

*   **API Authentication:** Bearer Token (JWT) or API Key (for Agents).
*   **Role-Based Access Control (RBAC):**
    *   **Admin:** Can manage Nodes and Settings.
    *   **Tester:** Can Create Scripts and Run Tests.
    *   **Viewer:** Read-only access to Results.
*   **Secure Storage:** API Keys (e.g., Slack Webhooks) must be encrypted at rest.
