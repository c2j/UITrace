# UITrace Backend Design Document (Node.js + Playwright)

## 1. Executive Summary
This document outlines the technical design for the UITrace backend. The system is a centralized control plane for UI automation, utilizing **Node.js** for the API and orchestration, and **Playwright** as the core execution engine.

The architecture is designed to interpret the JSON-based script steps defined in the frontend `ScriptEditor` and execute them across distributed "Agent" nodes, managing state via a relational database and real-time queues.

---

## 2. Technology Stack

*   **Runtime:** Node.js (v20 LTS).
*   **Framework:** NestJS (Recommended for structure) or Express.js (for simplicity). *Design assumes Express.js structure for clarity.*
*   **Language:** TypeScript (Strict mode).
*   **Database:** PostgreSQL.
*   **ORM:** Prisma.
*   **Message Queue:** BullMQ (Redis-based) for job orchestration.
*   **Core Engine:** Playwright (Library mode).
*   **Image Processing:** `pixelmatch` & `sharp`.
*   **Object Storage:** MinIO (Self-hosted S3 compatible) or AWS S3.
*   **Real-time Communication:** Socket.io (For Agent <-> Server heartbeats).

---

## 3. System Architecture

The system consists of three main components:

1.  **API Server (The Controller):** Handles REST API requests, manages projects/scripts, and schedules jobs.
2.  **Job Workers:** Processes background tasks (Results aggregation, Visual Diffing).
3.  **Execution Agents:** Lightweight Node.js services running on target machines (Windows, Linux, Mac) that physically run the browsers.

### High-Level Data Flow

```mermaid
graph TD
    Frontend[React Frontend] -->|REST API (OpenAPI)| APIServer[Node.js API Server]
    APIServer -->|Read/Write| DB[(PostgreSQL)]
    APIServer -->|Job Push| Redis[(Redis Queue)]
    APIServer -->|WebSocket| Agents[Execution Agents]
    
    subgraph Execution Agent
        JobWorker[Job Consumer]
        PW[Playwright Engine]
        SystemInfo[System Monitor]
    end
    
    Redis -->|Job Pop| Agents
    Agents -->|Screenshots/Traces| S3[(Object Storage)]
    Agents -->|Live Logs| APIServer
```

---

## 4. Database Schema Design (Prisma)

This schema maps directly to the Frontend `types.ts` and `openapi.yaml`.

```prisma
model Project {
  id        String   @id @default(uuid())
  name      String
  icon      String?
  versions  Version[]
}

model Version {
  id          String   @id @default(uuid())
  projectId   String
  name        String
  status      String   // active, archived, draft
  releaseDate DateTime
  project     Project  @relation(fields: [projectId], references: [id])
  modules     Module[]
}

model Module {
  id            String   @id @default(uuid())
  versionId     String
  name          String
  description   String?
  inheritedFrom String?  // ID of parent version if inherited
  scripts       Script[]
  version       Version  @relation(fields: [versionId], references: [id])
}

model Script {
  id              String       @id @default(uuid())
  moduleId        String
  name            String
  description     String?
  priority        String       // P0, P1, P2
  lastRunStatus   String?      // PASS, FAIL, SKIP, PENDING
  steps           Json         // Array of ScriptStep objects (Stores Selectors, Actions)
  module          Module       @relation(fields: [moduleId], references: [id])
  executions      Execution[]
}

model Execution {
  id             String   @id @default(uuid())
  scriptId       String
  status         String   // PASS, FAIL, SKIP, PENDING
  startTime      DateTime @default(now())
  endTime        DateTime?
  durationMs     Int?
  environment    String   // e.g. "Chrome 114 (Win 11)"
  triggeredBy    String
  qualityScore   Int?
  
  // Relations
  script         Script        @relation(fields: [scriptId], references: [id])
  logs           ExecutionLog[]
  visualDiffs    VisualDiff[]
  traceFileKey   String?       // S3 Key for trace.zip
}

model ExecutionLog {
  id          String    @id @default(uuid())
  executionId String
  timestamp   DateTime  @default(now())
  level       String    // INFO, DEBUG, ERROR
  message     String
  execution   Execution @relation(fields: [executionId], references: [id])
}

model VisualDiff {
  id              String    @id @default(uuid())
  executionId     String
  stepId          Int       // ID of the step that triggered screenshot
  baselineKey     String    // S3 Key
  actualKey       String    // S3 Key
  diffPercentage  Float
  execution       Execution @relation(fields: [executionId], references: [id])
}

model ServerNode {
  id             String   @id @default(uuid())
  name           String
  ip             String
  status         String   // ONLINE, OFFLINE, BUSY
  os             String
  browsers       Json     // Array of strings
  lastHeartbeat  DateTime
  hardwareStats  Json     // { cpu: 45, mem: 60 }
}
```

---

## 5. Core Implementation Details

### 5.1 The JSON-to-Playwright Interpreter (The Runner)

Instead of generating `.spec.ts` files, the Agent will run a generic "Driver" script that iterates over the JSON steps. This allows for dynamic error handling and self-healing.

**Logic Flow:**

1.  **Receive Job:** Agent receives `Script` object with `steps`.
2.  **Initialize Context:**
    ```typescript
    const browser = await chromium.launch({ headless: settings.headless });
    const context = await browser.newContext();
    // Start Tracing
    await context.tracing.start({ screenshots: true, snapshots: true });
    const page = await context.newPage();
    ```
3.  **Step Iteration:**
    ```typescript
    for (const step of script.steps) {
        try {
            await executeStep(page, step);
            emitLog('INFO', `Step ${step.id}: ${step.name} - SUCCESS`);
        } catch (e) {
            emitLog('ERROR', `Step ${step.id} Failed: ${e.message}`);
            // Logic to mark execution as FAIL and break loop
        }
    }
    ```
4.  **Action Execution & Self-Healing:**
    ```typescript
    async function executeStep(page, step) {
        // Handle "Smart Locators" - Try in priority order
        const selectors = step.selectors.sort((a, b) => a.priority - b.priority);
        let element = null;
        
        for (const selector of selectors) {
            try {
                // Playwright selector mapping
                const pwSelector = selector.type === 'xpath' ? selector.value : 
                                   selector.type === 'id' ? `#${selector.value}` : 
                                   selector.value;
                                   
                element = page.locator(pwSelector);
                await element.waitFor({ state: 'visible', timeout: 2000 }); // Short timeout for retry
                break; // Found it!
            } catch (err) {
                // Continue to next selector
                emitLog('DEBUG', `Selector ${selector.value} failed, trying next...`);
            }
        }

        if (!element) throw new Error("Element not found with any selector strategy");

        // Perform Action
        switch (step.action) {
            case 'click': await element.click(); break;
            case 'type': await element.fill(step.value); break;
            case 'navigate': await page.goto(step.value); break;
            case 'assert_text': 
                await expect(element).toHaveText(step.expectedValue); 
                break;
            case 'screenshot': 
                const buffer = await page.screenshot();
                await uploadAndDiff(buffer, step.id);
                break;
        }
    }
    ```

### 5.2 Visual Regression Pipeline

1.  **Capture:** Agent captures `Buffer` of screenshot during execution.
2.  **Upload:** Agent uploads `actual.png` to S3 (e.g., `executions/{id}/steps/{stepId}/actual.png`).
3.  **Baseline Check:** Backend checks if `baselines/{scriptId}/{stepId}/baseline.png` exists.
4.  **Diff:**
    *   If Baseline exists: Download both. Use `pixelmatch` to generate `diff.png` and calculate mismatched pixels.
    *   If No Baseline: The `actual.png` becomes the candidate. Diff is 0%.
5.  **Result:** Save `diffPercentage` to DB. If > tolerance, fail the test.

### 5.3 Infrastructure Management (WebSocket)

*   **Server Side:** Runs a `Socket.io` server.
*   **Agent Side:** Runs a persistent process.
    *   Uses `systeminformation` library to fetch CPU/RAM.
    *   Emits `heartbeat` event every 5 seconds:
        ```json
        {
          "nodeId": "node-01",
          "status": "ONLINE",
          "cpuUsage": 45,
          "memUsage": 60
        }
        ```
*   **Handling Disconnects:** If Server doesn't receive heartbeat for 30s, update DB status to `OFFLINE`.

---

## 6. API Endpoint Logic Mapping

### `GET /projects`
*   **Logic:** `prisma.project.findMany({ include: { versions: true } })`.
*   **Response:** Maps DB entities to frontend `Project` interface.

### `POST /scripts/{scriptId}/run`
*   **Logic:**
    1.  Create `Execution` record with status `PENDING`.
    2.  Fetch `Script` details.
    3.  Push job to `BullMQ` queue: `{ executionId: "...", script: { ... } }`.
    4.  Return `202 Accepted` with `executionId`.
*   **Async Processing:**
    *   Agent picks up job.
    *   Agent updates Execution status to `RUNNING`.
    *   On complete, Agent uploads trace.zip, updates status to `PASS/FAIL`.

### `GET /executions/{id}`
*   **Logic:** Fetch Execution + related `ExecutionLog` + `VisualDiff`.
*   **Metric Calculation:**
    *   `qualityScore` = (Passed Steps / Total Steps) * 100 - (ConsoleErrors * 5).

---

## 7. Folder Structure

```
/backend
  /src
    /config         # Env variables, DB config
    /controllers    # REST Route Handlers (matches OpenAPI paths)
      - ProjectsController.ts
      - ScriptsController.ts
      - ExecutionsController.ts
      - NodesController.ts
    /services       # Business Logic
      - ScriptRunner.ts
      - VisualDiffService.ts
      - StatsService.ts
    /models         # Prisma Client & Types
    /queue          # BullMQ Producers/Consumers
    /agent          # The Code that runs on the Node
      - Agent.ts    # WebSocket Client
      - Driver.ts   # JSON-to-Playwright Interpreter
    /utils          # S3 Helpers, Pixelmatch wrapper
  /prisma           # Schema & Migrations
  app.ts            # Entry point
```

## 8. Deployment Strategy

*   **Backend:** Docker container (Node.js).
*   **Database:** Docker container (PostgreSQL).
*   **Agent:**
    *   Can be deployed as a binary or Docker container on target machines.
    *   Must have network access to the Backend API.

