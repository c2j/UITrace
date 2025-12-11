import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import { PrismaClient, ServerNode } from '@prisma/client';
import { HeartbeatMonitor } from '../../src/modules/node/heartbeat-monitor';
import { NodeService } from '../../src/modules/node/service';
import { NodeRepository } from '../../src/modules/node/repository';
import { WebSocketService } from '../../src/libs/websocket';

const prisma = new PrismaClient();

describe('Node Lifecycle Integration Tests', () => {
  let app: FastifyInstance;
  let nodeRepo: NodeRepository;
  let nodeService: NodeService;
  let wsService: WebSocketService;
  let heartbeatMonitor: HeartbeatMonitor;
  let node: ServerNode;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();

    nodeRepo = new NodeRepository(prisma);
    wsService = new WebSocketService(app.server);
    nodeService = new NodeService(prisma, nodeRepo, wsService);
    heartbeatMonitor = new HeartbeatMonitor(
      prisma,
      nodeRepo,
      nodeService,
      wsService,
      {
        intervalMs: 1000, // Check every second for faster testing
        timeoutMinutes: 1/60, // 1 second timeout for testing
      }
    );
  });

  afterAll(async () => {
    await heartbeatMonitor.stop();
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up database
    await prisma.serverNode.deleteMany();

    // Create test node
    node = await prisma.serverNode.create({
      data: {
        name: 'Test Node',
        ip: '192.168.1.100',
        os: 'linux',
        status: 'ONLINE',
        lastHeartbeat: new Date(),
        browsers: [{ name: 'chrome', version: '120' }]
      }
    });
  });

  describe('Heartbeat Lifecycle', () => {
    it('should detect stale nodes and mark them offline', async () => {
      // Set node's last heartbeat to be stale
      await prisma.serverNode.update({
        where: { id: node.id },
        data: {
          lastHeartbeat: new Date(Date.now() - 5 * 1000), // 5 seconds ago
          status: 'ONLINE'
        }
      });

      // Start heartbeat monitor
      heartbeatMonitor.start();

      // Wait for monitor to check (2 seconds to be safe)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if node was marked offline
      const updatedNode = await prisma.serverNode.findUnique({
        where: { id: node.id }
      });

      expect(updatedNode.status).toBe('OFFLINE');

      // Stop monitor
      heartbeatMonitor.stop();
    });

    it('should not mark recent nodes as offline', async () => {
      // Update node with fresh heartbeat
      await prisma.serverNode.update({
        where: { id: node.id },
        data: {
          lastHeartbeat: new Date(),
          status: 'ONLINE'
        }
      });

      // Start heartbeat monitor
      heartbeatMonitor.start();

      // Wait for monitor to check
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check if node is still online
      const updatedNode = await prisma.serverNode.findUnique({
        where: { id: node.id }
      });

      expect(updatedNode.status).toBe('ONLINE');

      // Stop monitor
      heartbeatMonitor.stop();
    });

    it('should handle running executions when node goes stale', async () => {
      const executionId = 'test-execution-123';

      // Set node as busy with running execution
      await prisma.serverNode.update({
        where: { id: node.id },
        data: {
          lastHeartbeat: new Date(Date.now() - 5 * 1000), // 5 seconds ago
          status: 'BUSY',
          currentExecutionId: executionId
        }
      });

      // Create execution record
      await prisma.execution.create({
        data: {
          id: executionId,
          testSuiteId: 'test-suite-1',
          baseUrl: 'https://example.com',
          status: 'RUNNING',
          startTime: new Date(Date.now() - 10 * 1000), // Started 10 seconds ago
          capabilities: JSON.stringify([{ browser: 'chrome' }]),
          options: JSON.stringify({}),
          nodeId: node.id
        }
      });

      // Start heartbeat monitor
      heartbeatMonitor.start();

      // Wait for monitor to check and handle stale node
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Check execution was marked as failed
      const execution = await prisma.execution.findUnique({
        where: { id: executionId }
      });

      expect(execution.status).toBe('FAIL');
      expect(execution.endTime).toBeDefined();

      // Check failure was logged
      const logs = await prisma.executionLog.findMany({
        where: { executionId }
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('ERROR');
      expect(logs[0].message).toContain('went offline during execution');

      // Stop monitor
      heartbeatMonitor.stop();
    });
  });

  describe('Node Registration and Updates', () => {
    it('should update existing node on re-registration', async () => {
      const originalNode = node;

      const updateData = {
        name: 'Updated Node',
        ip: originalNode.ip,
        os: 'windows',
        browsers: [
          { name: 'chrome', version: '121', platform: 'windows' },
          { name: 'edge', version: '120', platform: 'windows' }
        ],
        hardwareStats: {
          cpu: 75.5,
          memory: 80.2,
          disk: 50.0
        }
      };

      // Re-register node with same IP
      const response = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: updateData,
      });

      expect(response.statusCode).toBe(201);
      const responseBody = JSON.parse(response.payload);
      const updatedNode = responseBody.data;

      // Should be same node ID
      expect(updatedNode.id).toBe(originalNode.id);

      // Should have updated info
      expect(updatedNode.name).toBe('Updated Node');
      expect(updatedNode.os).toBe('windows');
      expect(updatedNode.status).toBe('ONLINE');
      expect(updatedNode.hardwareStats).toEqual(updateData.hardwareStats);
    });

    it('should track hardware stats through heartbeats', async () => {
      const stats1 = { cpu: 45.0, memory: 60.5, disk: 30.2 };
      const stats2 = { cpu: 55.0, memory: 70.5, disk: 35.2 };

      // Send first heartbeat
      await app.inject({
        method: 'POST',
        url: `/nodes/${node.id}/heartbeat`,
        payload: { hardwareStats: stats1 },
      });

      // Send second heartbeat
      await app.inject({
        method: 'POST',
        url: `/nodes/${node.id}/heartbeat`,
        payload: { hardwareStats: stats2 },
      });

      // Check final stats
      const updatedNode = await prisma.serverNode.findUnique({
        where: { id: node.id }
      });

      expect(updatedNode.hardwareStats).toEqual(stats2);
    });
  });

  describe('Node Status Transitions', () => {
    it('should transition through valid node states', async () => {
      // Start ONLINE
      expect(node.status).toBe('ONLINE');

      // Mark as BUSY
      await app.inject({
        method: 'POST',
        url: `/nodes/${node.id}/maintenance`,
      });

      // Actually, let's test busy through service
      await nodeService.markNodeBusy(node.id);
      let updatedNode = await prisma.serverNode.findUnique({
        where: { id: node.id }
      });
      expect(updatedNode.status).toBe('BUSY');

      // Mark back to AVAILABLE
      await nodeService.markNodeAvailable(node.id);
      updatedNode = await prisma.serverNode.findUnique({
        where: { id: node.id }
      });
      expect(updatedNode.status).toBe('ONLINE');

      // Mark as MAINTENANCE
      await app.inject({
        method: 'POST',
        url: `/nodes/${node.id}/maintenance`,
      });
      updatedNode = await prisma.serverNode.findUnique({
        where: { id: node.id }
      });
      expect(updatedNode.status).toBe('MAINTENANCE');

      // Mark as OFFLINE
      await nodeService.markNodeOffline(node.id);
      updatedNode = await prisma.serverNode.findUnique({
        where: { id: node.id }
      });
      expect(updatedNode.status).toBe('OFFLINE');
    });

    it('should prevent deletion of busy nodes', async () => {
      // Mark node as busy
      await nodeService.markNodeBusy(node.id);
      await prisma.serverNode.update({
        where: { id: node.id },
        data: { currentExecutionId: 'fake-execution-id' }
      });

      // Try to delete
      const response = await app.inject({
        method: 'DELETE',
        url: `/nodes/${node.id}`,
      });

      expect(response.statusCode).toBe(409);
    });

    it('should allow deletion of non-busy nodes', async () => {
      // Ensure node is not busy
      await nodeService.markNodeAvailable(node.id);

      // Delete node
      const response = await app.inject({
        method: 'DELETE',
        url: `/nodes/${node.id}`,
      });

      expect(response.statusCode).toBe(200);

      // Verify node is deleted
      const deletedNode = await prisma.serverNode.findUnique({
        where: { id: node.id }
      });
      expect(deletedNode).toBeNull();
    });
  });

  describe('Best Node Selection', () => {
    beforeEach(async () => {
      // Create additional test nodes
      await prisma.serverNode.createMany({
        data: [
          {
            name: 'Idle Chrome Node',
            ip: '192.168.1.101',
            os: 'linux',
            status: 'ONLINE',
            lastHeartbeat: new Date(),
            browsers: [{ name: 'chrome', version: '120' }]
          },
          {
            name: 'Busy Chrome Node',
            ip: '192.168.1.102',
            os: 'windows',
            status: 'BUSY',
            lastHeartbeat: new Date(),
            currentExecutionId: 'some-execution-id',
            browsers: [{ name: 'chrome', version: '120' }]
          },
          {
            name: 'Offline Chrome Node',
            ip: '192.168.1.103',
            os: 'macos',
            status: 'OFFLINE',
            lastHeartbeat: new Date(Date.now() - 10 * 60 * 1000),
            browsers: [{ name: 'chrome', version: '120' }]
          },
          {
            name: 'Firefox Node',
            ip: '192.168.1.104',
            os: 'linux',
            status: 'ONLINE',
            lastHeartbeat: new Date(),
            browsers: [{ name: 'firefox', version: '121' }]
          }
        ]
      });
    });

    it('should prefer idle nodes over busy nodes', async () => {
      const request = {
        capabilities: [{ browser: 'chrome' }]
      };

      const response = await app.inject({
        method: 'POST',
        url: '/nodes/find-best',
        payload: request,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.payload);

      // Should select the idle chrome node, not the busy one
      expect(responseBody.data.name).toBe('Idle Chrome Node');
      expect(responseBody.data.status).toBe('ONLINE');
    });

    it('should respect capability matching', async () => {
      const request = {
        capabilities: [{ browser: 'firefox' }]
      };

      const response = await app.inject({
        method: 'POST',
        url: '/nodes/find-best',
        payload: request,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.payload);

      expect(responseBody.data.name).toBe('Firefox Node');
      expect(responseBody.data.status).toBe('ONLINE');
    });

    it('should exclude specified nodes', async () => {
      // Get the idle chrome node
      const idleChromeNode = await prisma.serverNode.findFirst({
        where: { name: 'Idle Chrome Node' }
      });

      const request = {
        capabilities: [{ browser: 'chrome' }],
        excludeNodes: [idleChromeNode.id]
      };

      const response = await app.inject({
        method: 'POST',
        url: '/nodes/find-best',
        payload: request,
      });

      // Should return 404 since we excluded the only suitable node
      expect(response.statusCode).toBe(404);
    });
  });

  describe('WebSocket Integration', () => {
    it('should emit node status updates', async () => {
      let statusUpdate: any = null;

      // Mock WebSocket emission
      wsService.emitNodeStatus = (nodeId: string, data: any) => {
        if (nodeId === node.id) {
          statusUpdate = data;
        }
      };

      // Mark node as busy
      await nodeService.markNodeBusy(node.id);

      // Check if status was emitted
      expect(statusUpdate).not.toBeNull();
      expect(statusUpdate.status).toBe('BUSY');
      expect(statusUpdate.lastHeartbeat).toBeDefined();
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle multiple concurrent heartbeats', async () => {
      const promises = [];

      // Send 10 concurrent heartbeats
      for (let i = 0; i < 10; i++) {
        promises.push(
          app.inject({
            method: 'POST',
            url: `/nodes/${node.id}/heartbeat`,
            payload: {
              hardwareStats: {
                cpu: Math.random() * 100,
                memory: Math.random() * 100,
                disk: Math.random() * 100
              }
            }
          })
        );
      }

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach(response => {
        expect(response.statusCode).toBe(200);
      });

      // Node should still exist and be online
      const finalNode = await prisma.serverNode.findUnique({
        where: { id: node.id }
      });
      expect(finalNode.status).toBe('ONLINE');
    });

    it('should handle registration and heartbeat concurrently', async () => {
      const newNodeData = {
        name: 'Concurrent Node',
        ip: '192.168.1.200',
        os: 'linux',
        browsers: [{ name: 'chrome', version: '120' }]
      };

      // Start registration
      const registrationPromise = app.inject({
        method: 'POST',
        url: '/nodes',
        payload: newNodeData,
      });

      // Get the node after registration
      const registrationResponse = await registrationPromise;
      const registeredNode = JSON.parse(registrationResponse.payload).data;

      // Send immediate heartbeat
      const heartbeatResponse = await app.inject({
        method: 'POST',
        url: `/nodes/${registeredNode.id}/heartbeat`,
        payload: {
          hardwareStats: { cpu: 50, memory: 50, disk: 50 }
        }
      });

      expect(registrationResponse.statusCode).toBe(201);
      expect(heartbeatResponse.statusCode).toBe(200);
    });
  });
});