import { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app';
import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

describe('Nodes API Contract Tests', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up database
    await prisma.serverNode.deleteMany();
  });

  describe('POST /nodes', () => {
    it('should register a new node', async () => {
      const nodeData = {
        name: 'Test Node',
        ip: '192.168.1.100',
        os: 'linux',
        browsers: [
          { name: 'chrome', version: '120.0.6099.109', platform: 'linux' },
          { name: 'firefox', version: '121.0', platform: 'linux' }
        ],
        hardwareStats: {
          cpu: 45.5,
          memory: 60.2,
          disk: 30.8
        }
      };

      const response = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: nodeData,
      });

      expect(response.statusCode).toBe(201);
      const responseBody = JSON.parse(response.payload);

      expect(responseBody.success).toBe(true);
      expect(responseBody.data).toMatchObject({
        name: nodeData.name,
        ip: nodeData.ip,
        os: nodeData.os,
        status: 'ONLINE'
      });
      expect(responseBody.data.id).toBeDefined();
      expect(responseBody.data.createdAt).toBeDefined();
    });

    it('should return 400 for missing required fields', async () => {
      const invalidNodeData = {
        name: 'Test Node',
        // Missing ip, os, browsers
      };

      const response = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: invalidNodeData,
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.error).toContain('Missing required fields');
    });

    it('should return 400 for invalid IP format', async () => {
      const invalidNodeData = {
        name: 'Test Node',
        ip: 'invalid-ip',
        os: 'linux',
        browsers: [{ name: 'chrome', version: '120' }]
      };

      const response = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: invalidNodeData,
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.error).toContain('Invalid IP address format');
    });

    it('should update existing node with same IP', async () => {
      // First registration
      const nodeData = {
        name: 'Test Node',
        ip: '192.168.1.100',
        os: 'linux',
        browsers: [{ name: 'chrome', version: '120' }]
      };

      const firstResponse = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: nodeData,
      });

      expect(firstResponse.statusCode).toBe(201);
      const firstNode = JSON.parse(firstResponse.payload).data;

      // Update registration
      const updateData = {
        name: 'Updated Node',
        ip: '192.168.1.100',
        os: 'windows',
        browsers: [{ name: 'chrome', version: '121' }]
      };

      const updateResponse = await app.inject({
        method: 'POST',
        url: '/nodes',
        payload: updateData,
      });

      expect(updateResponse.statusCode).toBe(201);
      const updatedNode = JSON.parse(updateResponse.payload).data;
      expect(updatedNode.id).toBe(firstNode.id);
      expect(updatedNode.name).toBe('Updated Node');
      expect(updatedNode.os).toBe('windows');
    });
  });

  describe('POST /nodes/:nodeId/heartbeat', () => {
    let nodeId: string;

    beforeEach(async () => {
      const node = await prisma.serverNode.create({
        data: {
          name: 'Test Node',
          ip: '192.168.1.100',
          os: 'linux',
          status: 'ONLINE',
          browsers: [{ name: 'chrome', version: '120' }]
        }
      });
      nodeId = node.id;
    });

    it('should accept heartbeat for valid node', async () => {
      const heartbeatData = {
        hardwareStats: {
          cpu: 55.2,
          memory: 70.5,
          disk: 40.0
        }
      };

      const response = await app.inject({
        method: 'POST',
        url: `/nodes/${nodeId}/heartbeat`,
        payload: heartbeatData,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.payload);

      expect(responseBody.success).toBe(true);
      expect(responseBody.message).toBe('Heartbeat received');
      expect(responseBody.timestamp).toBeDefined();
    });

    it('should return 404 for non-existent node', async () => {
      const fakeNodeId = uuidv4();
      const response = await app.inject({
        method: 'POST',
        url: `/nodes/${fakeNodeId}/heartbeat`,
        payload: { hardwareStats: { cpu: 50 } },
      });

      expect(response.statusCode).toBe(404);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.error).toBe('Node not found');
    });

    it('should return 400 for invalid hardware stats', async () => {
      const invalidStats = {
        hardwareStats: {
          cpu: 150, // Invalid: > 100
          memory: -10, // Invalid: < 0
          disk: 'invalid' // Invalid: not number
        }
      };

      const response = await app.inject({
        method: 'POST',
        url: `/nodes/${nodeId}/heartbeat`,
        payload: invalidStats,
      });

      expect(response.statusCode).toBe(400);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.error).toContain('Hardware stats must be percentages');
    });
  });

  describe('GET /nodes', () => {
    beforeEach(async () => {
      // Create test nodes
      await prisma.serverNode.createMany({
        data: [
          {
            name: 'Online Node 1',
            ip: '192.168.1.101',
            os: 'linux',
            status: 'ONLINE',
            browsers: [{ name: 'chrome', version: '120' }]
          },
          {
            name: 'Offline Node',
            ip: '192.168.1.102',
            os: 'windows',
            status: 'OFFLINE',
            browsers: [{ name: 'firefox', version: '121' }]
          },
          {
            name: 'Busy Node',
            ip: '192.168.1.103',
            os: 'macos',
            status: 'BUSY',
            browsers: [{ name: 'safari', version: '17.0' }]
          }
        ]
      });
    });

    it('should return all nodes', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/nodes',
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.payload);

      expect(responseBody.success).toBe(true);
      expect(responseBody.data).toHaveLength(3);
      expect(responseBody.pagination).toBeDefined();
      expect(responseBody.pagination.total).toBe(3);
    });

    it('should filter nodes by status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/nodes?status=ONLINE',
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.payload);

      expect(responseBody.data).toHaveLength(1);
      expect(responseBody.data[0].status).toBe('ONLINE');
    });

    it('should support pagination', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/nodes?page=1&limit=2',
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.payload);

      expect(responseBody.data).toHaveLength(2);
      expect(responseBody.pagination.page).toBe(1);
      expect(responseBody.pagination.limit).toBe(2);
      expect(responseBody.pagination.total).toBe(3);
    });
  });

  describe('GET /nodes/:nodeId', () => {
    let nodeId: string;

    beforeEach(async () => {
      const node = await prisma.serverNode.create({
        data: {
          name: 'Test Node',
          ip: '192.168.1.100',
          os: 'linux',
          status: 'ONLINE',
          browsers: [{ name: 'chrome', version: '120' }]
        }
      });
      nodeId = node.id;
    });

    it('should return node by ID', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/nodes/${nodeId}`,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.payload);

      expect(responseBody.success).toBe(true);
      expect(responseBody.data.id).toBe(nodeId);
      expect(responseBody.data.name).toBe('Test Node');
    });

    it('should return 404 for non-existent node', async () => {
      const fakeNodeId = uuidv4();
      const response = await app.inject({
        method: 'GET',
        url: `/nodes/${fakeNodeId}`,
      });

      expect(response.statusCode).toBe(404);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.error).toBe('Node not found');
    });
  });

  describe('POST /nodes/find-best', () => {
    beforeEach(async () => {
      // Create test nodes with different capabilities
      await prisma.serverNode.createMany({
        data: [
          {
            name: 'Chrome Node',
            ip: '192.168.1.101',
            os: 'linux',
            status: 'ONLINE',
            browsers: [
              { name: 'chrome', version: '120' },
              { name: 'firefox', version: '121' }
            ]
          },
          {
            name: 'Safari Node',
            ip: '192.168.1.102',
            os: 'macos',
            status: 'ONLINE',
            browsers: [{ name: 'safari', version: '17.0' }]
          },
          {
            name: 'Offline Chrome Node',
            ip: '192.168.1.103',
            os: 'windows',
            status: 'OFFLINE',
            browsers: [{ name: 'chrome', version: '120' }]
          }
        ]
      });
    });

    it('should find best node matching capabilities', async () => {
      const request = {
        capabilities: [{ browser: 'chrome', version: '120' }]
      };

      const response = await app.inject({
        method: 'POST',
        url: '/nodes/find-best',
        payload: request,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.payload);

      expect(responseBody.success).toBe(true);
      expect(responseBody.data.name).toBe('Chrome Node');
      expect(responseBody.data.status).toBe('ONLINE');
    });

    it('should respect exclude nodes', async () => {
      // Get the Chrome node ID first
      const chromeNode = await prisma.serverNode.findFirst({
        where: { name: 'Chrome Node' }
      });

      const request = {
        capabilities: [{ browser: 'chrome' }],
        excludeNodes: [chromeNode.id]
      };

      const response = await app.inject({
        method: 'POST',
        url: '/nodes/find-best',
        payload: request,
      });

      expect(response.statusCode).toBe(404);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.error).toContain('No available node found');
    });

    it('should return 404 when no matching capabilities', async () => {
      const request = {
        capabilities: [{ browser: 'edge' }] // No node has Edge
      };

      const response = await app.inject({
        method: 'POST',
        url: '/nodes/find-best',
        payload: request,
      });

      expect(response.statusCode).toBe(404);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.error).toContain('No available node found');
    });
  });

  describe('PUT /nodes/:nodeId/capabilities', () => {
    let nodeId: string;

    beforeEach(async () => {
      const node = await prisma.serverNode.create({
        data: {
          name: 'Test Node',
          ip: '192.168.1.100',
          os: 'linux',
          status: 'ONLINE',
          browsers: [{ name: 'chrome', version: '120' }]
        }
      });
      nodeId = node.id;
    });

    it('should update node capabilities', async () => {
      const updateData = {
        browsers: [
          { name: 'chrome', version: '121' },
          { name: 'firefox', version: '122' },
          { name: 'edge', version: '120' }
        ]
      };

      const response = await app.inject({
        method: 'PUT',
        url: `/nodes/${nodeId}/capabilities`,
        payload: updateData,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.payload);

      expect(responseBody.success).toBe(true);
      expect(responseBody.data.browsers).toHaveLength(3);
    });

    it('should return 404 for non-existent node', async () => {
      const fakeNodeId = uuidv4();
      const response = await app.inject({
        method: 'PUT',
        url: `/nodes/${fakeNodeId}/capabilities`,
        payload: { browsers: [{ name: 'chrome' }] },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('POST /nodes/:nodeId/maintenance', () => {
    let nodeId: string;

    beforeEach(async () => {
      const node = await prisma.serverNode.create({
        data: {
          name: 'Test Node',
          ip: '192.168.1.100',
          os: 'linux',
          status: 'ONLINE',
          browsers: [{ name: 'chrome', version: '120' }]
        }
      });
      nodeId = node.id;
    });

    it('should set node to maintenance mode', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/nodes/${nodeId}/maintenance`,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.payload);

      expect(responseBody.success).toBe(true);
      expect(responseBody.message).toBe('Node set to maintenance mode');
    });

    it('should return 404 for non-existent node', async () => {
      const fakeNodeId = uuidv4();
      const response = await app.inject({
        method: 'POST',
        url: `/nodes/${fakeNodeId}/maintenance`,
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('DELETE /nodes/:nodeId', () => {
    let nodeId: string;

    beforeEach(async () => {
      const node = await prisma.serverNode.create({
        data: {
          name: 'Test Node',
          ip: '192.168.1.100',
          os: 'linux',
          status: 'ONLINE',
          browsers: [{ name: 'chrome', version: '120' }]
        }
      });
      nodeId = node.id;
    });

    it('should delete node', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: `/nodes/${nodeId}`,
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.payload);

      expect(responseBody.success).toBe(true);
      expect(responseBody.message).toBe('Node deleted successfully');
    });

    it('should return 409 when trying to delete busy node', async () => {
      // Set node to busy
      await prisma.serverNode.update({
        where: { id: nodeId },
        data: { status: 'BUSY', currentExecutionId: uuidv4() }
      });

      const response = await app.inject({
        method: 'DELETE',
        url: `/nodes/${nodeId}`,
      });

      expect(response.statusCode).toBe(409);
      const responseBody = JSON.parse(response.payload);
      expect(responseBody.error).toBe('Cannot delete node that is currently busy');
    });
  });

  describe('GET /nodes/stats', () => {
    beforeEach(async () => {
      await prisma.serverNode.createMany({
        data: [
          {
            name: 'Online Node 1',
            ip: '192.168.1.101',
            os: 'linux',
            status: 'ONLINE',
            browsers: [{ name: 'chrome', version: '120' }]
          },
          {
            name: 'Online Node 2',
            ip: '192.168.1.102',
            os: 'windows',
            status: 'ONLINE',
            browsers: [{ name: 'firefox', version: '121' }]
          },
          {
            name: 'Offline Node',
            ip: '192.168.1.103',
            os: 'macos',
            status: 'OFFLINE',
            browsers: [{ name: 'safari', version: '17.0' }]
          },
          {
            name: 'Busy Node',
            ip: '192.168.1.104',
            os: 'linux',
            status: 'BUSY',
            browsers: [{ name: 'chrome', version: '120' }]
          },
          {
            name: 'Maintenance Node',
            ip: '192.168.1.105',
            os: 'windows',
            status: 'MAINTENANCE',
            browsers: [{ name: 'edge', version: '120' }]
          }
        ]
      });
    });

    it('should return node statistics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/nodes/stats',
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.payload);

      expect(responseBody.success).toBe(true);
      expect(responseBody.data).toEqual({
        total: 5,
        online: 2,
        offline: 1,
        busy: 1,
        maintenance: 1
      });
    });
  });

  describe('GET /nodes/heartbeat-status', () => {
    beforeEach(async () => {
      await prisma.serverNode.createMany({
        data: [
          {
            name: 'Recent Node',
            ip: '192.168.1.101',
            os: 'linux',
            status: 'ONLINE',
            lastHeartbeat: new Date(),
            browsers: [{ name: 'chrome', version: '120' }]
          },
          {
            name: 'Stale Node',
            ip: '192.168.1.102',
            os: 'windows',
            status: 'ONLINE',
            lastHeartbeat: new Date(Date.now() - 10 * 60 * 1000), // 10 minutes ago
            browsers: [{ name: 'firefox', version: '121' }]
          }
        ]
      });
    });

    it('should return heartbeat monitor status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/nodes/heartbeat-status',
      });

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.payload);

      expect(responseBody.success).toBe(true);
      expect(responseBody.data.running).toBeDefined();
      expect(responseBody.data.stats).toBeDefined();
      expect(responseBody.data.stats.totalNodes).toBeGreaterThanOrEqual(0);
      expect(responseBody.data.stats.staleNodes).toBeGreaterThanOrEqual(0);
    });
  });
});