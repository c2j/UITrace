import request from 'supertest';
import { createApp } from '../../src/app';
import { PrismaClient } from '@prisma/client';

describe('Execution API Contract Tests', () => {
  let app: any;
  let prisma: PrismaClient;
  let testProject: any;
  let testVersion: any;
  let testModule: any;
  let testScript: any;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.prisma;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up database
    await prisma.executionLog.deleteMany();
    await prisma.visualDiff.deleteMany();
    await prisma.execution.deleteMany();
    await prisma.script.deleteMany();
    await prisma.module.deleteMany();
    await prisma.version.deleteMany();
    await prisma.project.deleteMany();

    // Create test data hierarchy
    testProject = await prisma.project.create({
      data: { name: 'Test Project' },
    });

    testVersion = await prisma.version.create({
      data: {
        projectId: testProject.id,
        name: 'v1.0.0',
        status: 'ACTIVE',
      },
    });

    testModule = await prisma.module.create({
      data: {
        versionId: testVersion.id,
        name: 'Test Module',
      },
    });

    testScript = await prisma.script.create({
      data: {
        moduleId: testModule.id,
        name: 'Test Script',
        priority: 'P1',
        steps: [
          {
            id: 1,
            name: 'Navigate to page',
            action: 'navigate',
            value: 'https://example.com',
            selectors: [{ type: 'css', value: 'body', priority: 1 }],
          },
          {
            id: 2,
            name: 'Click button',
            action: 'click',
            selectors: [{ type: 'css', value: 'button', priority: 1 }],
          },
        ],
      },
    });
  });

  describe('POST /api/v1/scripts/:scriptId/run', () => {
    it('should trigger script execution successfully', async () => {
      const runData = {
        environment: 'Chrome 120 (Windows 11)',
        triggeredBy: 'test-user',
      };

      const response = await request(app.server)
        .post(`/api/v1/scripts/${testScript.id}/run`)
        .send(runData)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: expect.any(String),
          scriptId: testScript.id,
          status: 'PENDING',
          environment: runData.environment,
          triggeredBy: runData.triggeredBy,
          startTime: expect.any(String),
        },
        message: 'Script execution started',
      });
    });

    it('should reject execution with missing required fields', async () => {
      const response = await request(app.server)
        .post(`/api/v1/scripts/${testScript.id}/run`)
        .send({})
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
      });
    });

    it('should reject execution for non-existent script', async () => {
      const fakeScriptId = '123e4567-e89b-12d3-a456-426614174000';

      const response = await request(app.server)
        .post(`/api/v1/scripts/${fakeScriptId}/run`)
        .send({
          environment: 'Test Env',
          triggeredBy: 'test',
        })
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Script not found',
      });
    });

    it('should accept execution with optional node ID', async () => {
      const runData = {
        environment: 'Firefox 121 (macOS)',
        triggeredBy: 'test-user',
        nodeId: 'node-123',
      };

      const response = await request(app.server)
        .post(`/api/v1/scripts/${testScript.id}/run`)
        .send(runData)
        .expect(200);

      expect(response.body.data.nodeId).toBe(runData.nodeId);
    });
  });

  describe('GET /api/v1/executions/:executionId', () => {
    let testExecution: any;

    beforeEach(async () => {
      testExecution = await prisma.execution.create({
        data: {
          scriptId: testScript.id,
          status: 'RUNNING',
          startTime: new Date(),
          environment: 'Test Environment',
          triggeredBy: 'test-user',
        },
      });
    });

    it('should get execution details', async () => {
      const response = await request(app.server)
        .get(`/api/v1/executions/${testExecution.id}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          id: testExecution.id,
          scriptId: testScript.id,
          status: 'RUNNING',
          environment: 'Test Environment',
          triggeredBy: 'test-user',
        },
      });
      expect(response.body.data).toHaveProperty('startTime');
    });

    it('should return 404 for non-existent execution', async () => {
      const fakeExecutionId = '123e4567-e89b-12d3-a456-426614174000';

      const response = await request(app.server)
        .get(`/api/v1/executions/${fakeExecutionId}`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Execution not found',
      });
    });

    it('should include execution logs and diffs when requested', async () => {
      // Create associated logs
      await prisma.executionLog.createMany({
        data: [
          {
            executionId: testExecution.id,
            level: 'INFO',
            message: 'Execution started',
            timestamp: new Date(),
          },
          {
            executionId: testExecution.id,
            level: 'INFO',
            message: 'Navigating to page',
            timestamp: new Date(),
          },
        ],
      });

      const response = await request(app.server)
        .get(`/api/v1/executions/${testExecution.id}?include=logs,diffs`)
        .expect(200);

      expect(response.body.data.logs).toBeDefined();
      expect(response.body.data.logs).toHaveLength(2);
    });
  });

  describe('GET /api/v1/executions', () => {
    beforeEach(async () => {
      // Create test executions with different statuses
      await prisma.execution.createMany({
        data: [
          {
            scriptId: testScript.id,
            status: 'PENDING',
            startTime: new Date(Date.now() - 10000),
            environment: 'Test Env 1',
            triggeredBy: 'user1',
          },
          {
            scriptId: testScript.id,
            status: 'RUNNING',
            startTime: new Date(Date.now() - 5000),
            environment: 'Test Env 2',
            triggeredBy: 'user2',
          },
          {
            scriptId: testScript.id,
            status: 'PASS',
            startTime: new Date(Date.now() - 15000),
            endTime: new Date(Date.now() - 10000),
            durationMs: 5000,
            environment: 'Test Env 3',
            triggeredBy: 'user3',
          },
        ],
      });
    });

    it('should list executions with pagination', async () => {
      const response = await request(app.server)
        .get('/api/v1/executions')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
        pagination: {
          page: 1,
          limit: 10,
          total: 3,
          totalPages: 1,
        },
      });
      expect(response.body.data).toHaveLength(3);
    });

    it('should filter executions by status', async () => {
      const response = await request(app.server)
        .get('/api/v1/executions?status=RUNNING')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].status).toBe('RUNNING');
    });

    it('should filter executions by script ID', async () => {
      const response = await request(app.server)
        .get(`/api/v1/executions?scriptId=${testScript.id}`)
        .expect(200);

      expect(response.body.data).toHaveLength(3);
      response.body.data.forEach((exec: any) => {
        expect(exec.scriptId).toBe(testScript.id);
      });
    });

    it('should filter executions by date range', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const response = await request(app.server)
        .get(`/api/v1/executions?startDate=${oneHourAgo.toISOString()}&endDate=${now.toISOString()}`)
        .expect(200);

      expect(response.body.data).toHaveLength(3);
    });

    it('should sort executions by start time descending by default', async () => {
      const response = await request(app.server)
        .get('/api/v1/executions')
        .expect(200);

      const executions = response.body.data;
      expect(new Date(executions[0].startTime).getTime()).toBeGreaterThan(
        new Date(executions[1].startTime).getTime()
      );
    });
  });

  describe('GET /api/v1/executions/:executionId/logs', () => {
    let testExecution: any;

    beforeEach(async () => {
      testExecution = await prisma.execution.create({
        data: {
          scriptId: testScript.id,
          status: 'RUNNING',
          startTime: new Date(),
          environment: 'Test Environment',
          triggeredBy: 'test-user',
        },
      });

      // Create test logs
      await prisma.executionLog.createMany({
        data: [
          {
            executionId: testExecution.id,
            level: 'INFO',
            message: 'Starting execution',
            timestamp: new Date(Date.now() - 3000),
            stepId: 0,
          },
          {
            executionId: testExecution.id,
            level: 'DEBUG',
            message: 'Navigating to https://example.com',
            timestamp: new Date(Date.now() - 2000),
            stepId: 1,
          },
          {
            executionId: testExecution.id,
            level: 'ERROR',
            message: 'Element not found',
            timestamp: new Date(Date.now() - 1000),
            stepId: 2,
          },
          {
            executionId: testExecution.id,
            level: 'WARN',
            message: 'Retrying with longer timeout',
            timestamp: new Date(Date.now() - 500),
            stepId: 2,
          },
        ],
      });
    });

    it('should get execution logs', async () => {
      const response = await request(app.server)
        .get(`/api/v1/executions/${testExecution.id}/logs`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
      });
      expect(response.body.data).toHaveLength(4);

      // Verify logs are sorted by timestamp
      const logs = response.body.data;
      for (let i = 1; i < logs.length; i++) {
        expect(new Date(logs[i].timestamp).getTime()).toBeGreaterThanOrEqual(
          new Date(logs[i - 1].timestamp).getTime()
        );
      }
    });

    it('should filter logs by level', async () => {
      const response = await request(app.server)
        .get(`/api/v1/executions/${testExecution.id}/logs?level=ERROR`)
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].level).toBe('ERROR');
    });

    it('should filter logs by step ID', async () => {
      const response = await request(app.server)
        .get(`/api/v1/executions/${testExecution.id}/logs?stepId=2`)
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      response.body.data.forEach((log: any) => {
        expect(log.stepId).toBe(2);
      });
    });

    it('should support pagination for logs', async () => {
      const response = await request(app.server)
        .get(`/api/v1/executions/${testExecution.id}/logs?page=1&limit=2`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: expect.any(Array),
        pagination: {
          page: 1,
          limit: 2,
          total: 4,
          totalPages: 2,
        },
      });
      expect(response.body.data).toHaveLength(2);
    });
  });

  describe('POST /api/v1/executions/:executionId/stop', () => {
    let testExecution: any;

    beforeEach(async () => {
      testExecution = await prisma.execution.create({
        data: {
          scriptId: testScript.id,
          status: 'RUNNING',
          startTime: new Date(),
          environment: 'Test Environment',
          triggeredBy: 'test-user',
        },
      });
    });

    it('should stop a running execution', async () => {
      const response = await request(app.server)
        .post(`/api/v1/executions/${testExecution.id}/stop`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Execution stopped successfully',
      });

      // Verify execution status is updated
      const updatedExecution = await prisma.execution.findUnique({
        where: { id: testExecution.id },
      });
      expect(updatedExecution?.status).toBe('SKIP');
    });

    it('should reject stopping completed execution', async () => {
      // Mark execution as completed
      await prisma.execution.update({
        where: { id: testExecution.id },
        data: {
          status: 'PASS',
          endTime: new Date(),
        },
      });

      const response = await request(app.server)
        .post(`/api/v1/executions/${testExecution.id}/stop`)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('Cannot stop completed execution'),
      });
    });

    it('should return 404 for non-existent execution', async () => {
      const fakeExecutionId = '123e4567-e89b-12d3-a456-426614174000';

      const response = await request(app.server)
        .post(`/api/v1/executions/${fakeExecutionId}/stop`)
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Execution not found',
      });
    });
  });

  describe('WebSocket endpoint /ws', () => {
    it('should accept WebSocket connections', async () => {
      // Note: This is a basic test. In a real scenario, you'd use a WebSocket client library
      // to test the actual WebSocket functionality
      const response = await request(app.server)
        .get('/ws')
        .expect(400); // WebSocket upgrade required

      // The endpoint should exist and attempt to upgrade to WebSocket
      expect(response.status).not.toBe(404);
    });
  });

  describe('Agent Registration', () => {
    it('should register a new execution node', async () => {
      const nodeData = {
        name: 'test-node-1',
        ip: '192.168.1.100',
        os: 'Windows 11',
        browsers: [
          {
            name: 'chrome',
            version: '120.0.0',
            platform: 'windows',
          },
          {
            name: 'firefox',
            version: '121.0.0',
            platform: 'windows',
          },
        ],
        hardwareStats: {
          cpu: 45,
          memory: 60,
          disk: 30,
        },
      };

      const response = await request(app.server)
        .post('/api/v1/nodes/register')
        .send(nodeData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          name: nodeData.name,
          ip: nodeData.ip,
          os: nodeData.os,
          status: 'ONLINE',
          browsers: nodeData.browsers,
        },
        message: 'Node registered successfully',
      });
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('lastHeartbeat');
    });

    it('should reject node registration with invalid browser data', async () => {
      const nodeData = {
        name: 'invalid-node',
        ip: '192.168.1.101',
        os: 'macOS',
        browsers: [
          {
            name: 'invalid-browser',
            version: '1.0',
            platform: 'macos',
          },
        ],
      };

      const response = await request(app.server)
        .post('/api/v1/nodes/register')
        .send(nodeData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
      });
    });
  });
});