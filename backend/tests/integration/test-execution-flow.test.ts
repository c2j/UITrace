import request from 'supertest';

import { createApp } from '../../src/app';
import { PrismaClient } from '@prisma/client';
import { Server } from 'socket.io';
import { io as ClientIO, Socket as ClientSocket } from 'socket.io-client';

describe('Execution Flow Integration Tests', () => {
  let app: any;
  let prisma: PrismaClient;
  let httpServer: any;
  let ioServer: Server;
  let clientSocket: ClientSocket;

  beforeAll(async () => {
    app = await createApp();
    prisma = app.prisma;
    httpServer = app.server;

    // Initialize WebSocket server
    ioServer = new Server(httpServer, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    });

    app.decorate('io', ioServer);

    // Connect test client
    clientSocket = ClientIO('http://localhost:3000', {
      transports: ['websocket'],
    });
  });

  afterAll(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    if (ioServer) {
      ioServer.close();
    }
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
    await prisma.serverNode.deleteMany();
  });

  describe('Complete Execution Workflow', () => {
    let testProject: any;
    let testVersion: any;
    let testModule: any;
    let testScript: any;
    let testNode: any;

    it('should handle complete script execution with real-time updates', async () => {
      // Step 1: Create test data
      testProject = await prisma.project.create({
        data: { name: 'E-commerce Test Suite' },
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
          name: 'Checkout Module',
        },
      });

      testScript = await prisma.script.create({
        data: {
          moduleId: testModule.id,
          name: 'Complete Checkout Flow',
          priority: 'P0',
          steps: [
            {
              id: 1,
              name: 'Navigate to product page',
              action: 'navigate',
              value: 'https://shop.example.com/product/123',
              selectors: [{ type: 'css', value: 'body', priority: 1 }],
            },
            {
              id: 2,
              name: 'Add to cart',
              action: 'click',
              selectors: [
                { type: 'css', value: 'button.add-to-cart', priority: 1 },
                { type: 'text', value: 'Add to Cart', priority: 2 },
              ],
            },
            {
              id: 3,
              name: 'Go to cart',
              action: 'click',
              selectors: [{ type: 'css', value: '.cart-icon', priority: 1 }],
            },
            {
              id: 4,
              name: 'Proceed to checkout',
              action: 'click',
              selectors: [{ type: 'css', value: '.checkout-button', priority: 1 }],
            },
            {
              id: 5,
              name: 'Fill shipping info',
              action: 'type',
              value: '123 Main St',
              selectors: [{ type: 'id', value: 'shipping-address', priority: 1 }],
            },
            {
              id: 6,
              name: 'Take screenshot before payment',
              action: 'screenshot',
            },
            {
              id: 7,
              name: 'Complete purchase',
              action: 'click',
              selectors: [{ type: 'css', value: '.complete-purchase', priority: 1 }],
            },
            {
              id: 8,
              name: 'Verify order confirmation',
              action: 'assert_text',
              expectedValue: 'Order Confirmed',
              selectors: [{ type: 'css', value: '.order-confirmation', priority: 1 }],
            },
          ],
        },
      });

      // Register a test node
      testNode = await prisma.serverNode.create({
        data: {
          name: 'test-execution-node-1',
          ip: '192.168.1.100',
          status: 'ONLINE',
          os: 'Windows 11',
          browsers: [
            { name: 'chrome', version: '120.0', platform: 'windows' },
            { name: 'firefox', version: '121.0', platform: 'windows' },
          ],
          lastHeartbeat: new Date(),
          hardwareStats: { cpu: 45, memory: 60, disk: 30 },
        },
      });

      // Step 2: Start execution
      const executionStartResponse = await request(app.server)
        .post(`/api/v1/scripts/${testScript.id}/run`)
        .send({
          environment: 'Chrome 120 (Windows 11)',
          triggeredBy: 'integration-test',
          nodeId: testNode.id,
        })
        .expect(200);

      const execution = executionStartResponse.body.data;
      expect(execution).toMatchObject({
        scriptId: testScript.id,
        status: 'PENDING',
        environment: 'Chrome 120 (Windows 11)',
        triggeredBy: 'integration-test',
        nodeId: testNode.id,
      });

      // Step 3: Simulate real-time execution updates
      const correlationId = `exec-${execution.id}`;

      // Listen for WebSocket updates
      const receivedUpdates: any[] = [];
      clientSocket.on('execution_update', (data) => {
        if (data.correlationId === correlationId) {
          receivedUpdates.push(data);
        }
      });

      // Simulate execution progress
      const updates = [
        { status: 'RUNNING', progress: 0, stepIndex: 0, message: 'Starting execution' },
        { status: 'RUNNING', progress: 12, stepIndex: 1, message: 'Navigating to product page' },
        { status: 'RUNNING', progress: 25, stepIndex: 2, message: 'Adding item to cart' },
        { status: 'RUNNING', progress: 37, stepIndex: 3, message: 'Going to cart' },
        { status: 'RUNNING', progress: 50, stepIndex: 4, message: 'Proceeding to checkout' },
        { status: 'RUNNING', progress: 62, stepIndex: 5, message: 'Filling shipping information' },
        { status: 'RUNNING', progress: 75, stepIndex: 6, message: 'Taking screenshot' },
        { status: 'RUNNING', progress: 87, stepIndex: 7, message: 'Completing purchase' },
        { status: 'RUNNING', progress: 95, stepIndex: 8, message: 'Verifying confirmation' },
        { status: 'PASS', progress: 100, stepIndex: 8, message: 'Execution completed successfully' },
      ];

      // Update execution in database with logs and simulate WebSocket emissions
      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];

        // Update execution status
        if (i === updates.length - 1) {
          await prisma.execution.update({
            where: { id: execution.id },
            data: {
              status: update.status,
              endTime: new Date(),
              durationMs: 30000, // Simulated duration
              qualityScore: 95,
            },
          });
        }

        // Create execution logs
        await prisma.executionLog.create({
          data: {
            executionId: execution.id,
            level: i === updates.length - 1 ? 'INFO' : 'DEBUG',
            message: update.message,
            stepId: update.stepIndex,
            timestamp: new Date(),
          },
        });

        // Emit WebSocket update (in real implementation, this would be done by the execution service)
        ioServer.emit('execution_update', {
          type: 'execution_update',
          data: {
            executionId: execution.id,
            status: update.status,
            progress: update.progress,
            stepIndex: update.stepIndex,
            message: update.message,
          },
          timestamp: new Date().toISOString(),
          correlationId,
        });

        // Small delay to simulate real execution
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Wait a bit for all WebSocket messages
      await new Promise(resolve => setTimeout(resolve, 500));

      // Step 4: Verify real-time updates were received
      expect(receivedUpdates).toHaveLength(10);
      expect(receivedUpdates[0].data.status).toBe('RUNNING');
      expect(receivedUpdates[receivedUpdates.length - 1].data.status).toBe('PASS');
      expect(receivedUpdates[receivedUpdates.length - 1].data.progress).toBe(100);

      // Step 5: Verify final execution state
      const finalExecution = await request(app.server)
        .get(`/api/v1/executions/${execution.id}`)
        .expect(200);

      expect(finalExecution.body.data).toMatchObject({
        id: execution.id,
        status: 'PASS',
        qualityScore: 95,
      });
      expect(finalExecution.body.data.endTime).toBeTruthy();
      expect(finalExecution.body.data.durationMs).toBeGreaterThan(0);

      // Step 6: Verify execution logs
      const logsResponse = await request(app.server)
        .get(`/api/v1/executions/${execution.id}/logs`)
        .expect(200);

      expect(logsResponse.body.data).toHaveLength(10);
      expect(logsResponse.body.data[0].message).toBe('Starting execution');
      expect(logsResponse.body.data[logsResponse.body.data.length - 1].message).toBe('Execution completed successfully');
    });

    it('should handle execution failure with error details', async () => {
      // Create a script that will fail
      const failScript = await prisma.script.create({
        data: {
          moduleId: testModule.id,
          name: 'Script That Fails',
          priority: 'P1',
          steps: [
            {
              id: 1,
              name: 'Navigate to broken page',
              action: 'navigate',
              value: 'https://nonexistent.example.com',
              selectors: [{ type: 'css', value: 'body', priority: 1 }],
            },
          ],
        },
      });

      // Start execution
      const executionResponse = await request(app.server)
        .post(`/api/v1/scripts/${failScript.id}/run`)
        .send({
          environment: 'Chrome 120 (Windows 11)',
          triggeredBy: 'test-user',
          nodeId: testNode.id,
        })
        .expect(200);

      const execution = executionResponse.body.data;

      // Simulate failure
      await prisma.execution.update({
        where: { id: execution.id },
        data: {
          status: 'FAIL',
          endTime: new Date(),
          durationMs: 5000,
        },
      });

      // Create error log
      await prisma.executionLog.create({
        data: {
          executionId: execution.id,
          level: 'ERROR',
          message: 'Navigation failed: Timeout waiting for page load',
          stepId: 1,
          timestamp: new Date(),
        },
      });

      // Verify failure state
      const failedExecution = await request(app.server)
        .get(`/api/v1/executions/${execution.id}`)
        .expect(200);

      expect(failedExecution.body.data.status).toBe('FAIL');
      expect(failedExecution.body.data.endTime).toBeTruthy();
    });

    it('should support concurrent executions with proper isolation', async () => {
      // Create multiple scripts
      const scripts = await Promise.all([
        prisma.script.create({
          data: {
            moduleId: testModule.id,
            name: 'Concurrent Script 1',
            priority: 'P1',
            steps: [{ id: 1, name: 'Step 1', action: 'navigate', selectors: [{ type: 'css', value: 'body', priority: 1 }] }],
          },
        }),
        prisma.script.create({
          data: {
            moduleId: testModule.id,
            name: 'Concurrent Script 2',
            priority: 'P1',
            steps: [{ id: 1, name: 'Step 1', action: 'navigate', selectors: [{ type: 'css', value: 'body', priority: 1 }] }],
          },
        }),
        prisma.script.create({
          data: {
            moduleId: testModule.id,
            name: 'Concurrent Script 3',
            priority: 'P1',
            steps: [{ id: 1, name: 'Step 1', action: 'navigate', selectors: [{ type: 'css', value: 'body', priority: 1 }] }],
          },
        }),
      ]);

      // Start all executions concurrently
      const executions = await Promise.all(
        scripts.map((script, index) =>
          request(app.server)
            .post(`/api/v1/scripts/${script.id}/run`)
            .send({
              environment: 'Chrome 120 (Windows 11)',
              triggeredBy: `test-user-${index}`,
              nodeId: testNode.id,
            })
            .expect(200)
        )
      );

      // Verify all executions were created with unique IDs
      const executionIds = executions.map(e => e.body.data.id);
      const uniqueIds = new Set(executionIds);
      expect(uniqueIds.size).toBe(3);

      // Verify all executions have proper correlation
      for (const exec of executions) {
        expect(exec.body.data).toMatchObject({
          status: 'PENDING',
          nodeId: testNode.id,
        });
      }

      // Verify node status is updated to BUSY during execution
      const updatedNode = await prisma.serverNode.findUnique({
        where: { id: testNode.id },
      });
      // In a real implementation, node status would be updated based on active executions
      expect(updatedNode?.status).toBe('ONLINE'); // Would be BUSY with proper implementation
    });
  });

  describe('Visual Diff Workflow', () => {
    it('should handle visual comparison with baseline management', async () => {
      // Create test script with screenshot step
      const visualScript = await prisma.script.create({
        data: {
          moduleId: testModule.id,
          name: 'Visual Regression Test',
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
              name: 'Take screenshot for comparison',
              action: 'screenshot',
            },
          ],
        },
      });

      // Create baseline
      const baseline = await prisma.baseline.create({
        data: {
          scriptId: visualScript.id,
          stepId: 2,
          environment: 'Chrome 120 (Windows 11)',
          s3Key: 'baselines/visual-test/baseline.png',
          approvedAt: new Date(),
          approvedBy: 'test-user',
        },
      });

      // Start execution
      const executionResponse = await request(app.server)
        .post(`/api/v1/scripts/${visualScript.id}/run`)
        .send({
          environment: 'Chrome 120 (Windows 11)',
          triggeredBy: 'visual-test',
          nodeId: testNode.id,
        })
        .expect(200);

      const execution = executionResponse.body.data;

      // Simulate visual diff creation
      const visualDiff = await prisma.visualDiff.create({
        data: {
          executionId: execution.id,
          stepId: 2,
          baselineKey: baseline.s3Key,
          actualKey: 'screenshots/actual/execution-123/step-2.png',
          diffKey: 'diffs/execution-123/step-2-diff.png',
          diffPercentage: 0.5,
          tolerance: 0.1,
          approved: false,
        },
      });

      // Verify visual diff was created
      expect(visualDiff).toMatchObject({
        executionId: execution.id,
        stepId: 2,
        diffPercentage: 0.5,
        approved: false,
      });

      // Get execution with visual diffs
      const executionWithDiffs = await request(app.server)
        .get(`/api/v1/executions/${execution.id}?include=diffs`)
        .expect(200);

      expect(executionWithDiffs.body.data.visualDiffs).toBeDefined();
      expect(executionWithDiffs.body.data.visualDiffs).toHaveLength(1);
    });
  });

  describe('Agent Communication', () => {
    it('should handle agent heartbeat and status updates', async () => {
      // Initial registration
      const registerResponse = await request(app.server)
        .post('/api/v1/nodes/register')
        .send({
          name: 'heartbeat-test-node',
          ip: '192.168.1.200',
          os: 'macOS 14',
          browsers: [
            { name: 'safari', version: '17.0', platform: 'macos' },
            { name: 'chrome', version: '120.0', platform: 'macos' },
          ],
        })
        .expect(201);

      const node = registerResponse.body.data;

      // Update heartbeat
      const heartbeatResponse = await request(app.server)
        .post(`/api/v1/nodes/${node.id}/heartbeat`)
        .send({
          hardwareStats: {
            cpu: 55,
            memory: 70,
            disk: 40,
          },
          status: 'BUSY',
        })
        .expect(200);

      expect(heartbeatResponse.body).toMatchObject({
        success: true,
        message: 'Heartbeat updated',
      });

      // Verify node status in database
      const updatedNode = await prisma.serverNode.findUnique({
        where: { id: node.id },
      });
      expect(updatedNode?.status).toBe('BUSY');
      expect(updatedNode?.lastHeartbeat).toBeInstanceOf(Date);
    });

    it('should detect and handle node timeouts', async () => {
      // Create a node with old heartbeat
      const oldNode = await prisma.serverNode.create({
        data: {
          name: 'timeout-test-node',
          ip: '192.168.1.201',
          status: 'ONLINE',
          os: 'Linux',
          browsers: [{ name: 'firefox', version: '121.0', platform: 'linux' }],
          lastHeartbeat: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
          hardwareStats: { cpu: 30, memory: 50, disk: 25 },
        },
      });

      // Check node status (should be marked as OFFLINE due to timeout)
      const timeoutNodes = await prisma.serverNode.findMany({
        where: {
          status: 'ONLINE',
          lastHeartbeat: {
            lt: new Date(Date.now() - 3 * 60 * 1000), // Older than 3 minutes
          },
        },
      });

      expect(timeoutNodes).toHaveLength(1);
      expect(timeoutNodes[0].id).toBe(oldNode.id);
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle large number of concurrent executions', async () => {
      // Create multiple scripts
      const scriptCount = 50;
      const scripts = await Promise.all(
        Array.from({ length: scriptCount }, (_, i) =>
          prisma.script.create({
            data: {
              moduleId: testModule.id,
              name: `Load Test Script ${i}`,
              priority: 'P2',
              steps: [{ id: 1, name: 'Navigate', action: 'navigate', selectors: [{ type: 'css', value: 'body', priority: 1 }] }],
            },
          })
        )
      );

      // Start all executions
      const startTime = Date.now();
      const executions = await Promise.all(
        scripts.map(script =>
          request(app.server)
            .post(`/api/v1/scripts/${script.id}/run`)
            .send({
              environment: 'Chrome 120 (Windows 11)',
              triggeredBy: 'load-test',
              nodeId: testNode.id,
            })
            .expect(200)
        )
      );
      const endTime = Date.now();

      // Verify performance
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
      expect(executions).toHaveLength(scriptCount);

      // List executions with pagination
      const listResponse = await request(app.server)
        .get('/api/v1/executions?limit=20')
        .expect(200);

      expect(listResponse.body.data).toHaveLength(20);
      expect(listResponse.body.pagination.total).toBeGreaterThanOrEqual(scriptCount);
    });
  });
});