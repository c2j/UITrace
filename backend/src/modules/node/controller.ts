import { FastifyRequest, FastifyReply } from 'fastify';
import { NodeService, NodeRegistrationData, NodeCapability } from './service';
import { HeartbeatMonitor } from './heartbeat-monitor';
import { logger } from '../../utils/logger';
import { createError, notFound, badRequest } from '../../middleware/errorHandler';

export class NodeController {
  constructor(
    private nodeService: NodeService,
    private heartbeatMonitor: HeartbeatMonitor
  ) {}

  // Register a new node or update existing node
  async registerNode(
    request: FastifyRequest<{ Body: NodeRegistrationData }>,
    reply: FastifyReply
  ) {
    try {
      const nodeData = request.body;

      // Validate required fields
      if (!nodeData.name || !nodeData.ip || !nodeData.os || !nodeData.browsers) {
        reply.code(400);
        return { error: 'Missing required fields: name, ip, os, browsers' };
      }

      // Validate IP format
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(nodeData.ip)) {
        reply.code(400);
        return { error: 'Invalid IP address format' };
      }

      // Validate browsers
      if (!Array.isArray(nodeData.browsers) || nodeData.browsers.length === 0) {
        reply.code(400);
        return { error: 'At least one browser capability is required' };
      }

      const node = await this.nodeService.registerNode(nodeData);

      logger.info('Node registered successfully', {
        nodeId: node.id,
        nodeName: node.name,
        ip: node.ip,
        browsers: node.browsers.map(b => b.name),
      });

      reply.code(201);
      return {
        success: true,
        data: node,
      };
    } catch (error) {
      logger.error('Failed to register node', { error: error.message });
      reply.code(500);
      return { error: 'Failed to register node' };
    }
  }

  // Send heartbeat to keep node alive
  async heartbeat(
    request: FastifyRequest<{
      Params: { nodeId: string };
      Body: {
        hardwareStats?: {
          cpu: number;
          memory: number;
          disk: number;
        };
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { nodeId } = request.params;
      const { hardwareStats } = request.body;

      // Validate node exists
      const node = await this.nodeService.getNodeById(nodeId);
      if (!node) {
        reply.code(404);
        return { error: 'Node not found' };
      }

      // Validate hardware stats if provided
      if (hardwareStats) {
        const { cpu, memory, disk } = hardwareStats;
        if (
          typeof cpu !== 'number' || cpu < 0 || cpu > 100 ||
          typeof memory !== 'number' || memory < 0 || memory > 100 ||
          typeof disk !== 'number' || disk < 0 || disk > 100
        ) {
          reply.code(400);
          return { error: 'Hardware stats must be percentages between 0 and 100' };
        }
      }

      await this.nodeService.updateNodeHeartbeat(nodeId, hardwareStats);

      return {
        success: true,
        message: 'Heartbeat received',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      logger.error('Failed to process heartbeat', {
        nodeId: request.params.nodeId,
        error: error.message,
      });
      reply.code(500);
      return { error: 'Failed to process heartbeat' };
    }
  }

  // Get all nodes with optional filtering
  async getNodes(
    request: FastifyRequest<{
      Querystring: {
        status?: string;
        page?: string;
        limit?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { status, page, limit } = request.query;

      const options: any = {};
      if (status) {
        options.status = status.toUpperCase();
      }
      if (page) {
        options.page = parseInt(page, 10);
      }
      if (limit) {
        options.limit = parseInt(limit, 10);
      }

      const result = await this.nodeService.getAllNodes(options);

      return {
        success: true,
        data: result.nodes,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
        },
      };
    } catch (error) {
      logger.error('Failed to get nodes', { error: error.message });
      reply.code(500);
      return { error: 'Failed to get nodes' };
    }
  }

  // Get node by ID
  async getNode(
    request: FastifyRequest<{ Params: { nodeId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { nodeId } = request.params;

      const node = await this.nodeService.getNodeById(nodeId);
      if (!node) {
        reply.code(404);
        return { error: 'Node not found' };
      }

      return {
        success: true,
        data: node,
      };
    } catch (error) {
      logger.error('Failed to get node', {
        nodeId: request.params.nodeId,
        error: error.message,
      });
      reply.code(500);
      return { error: 'Failed to get node' };
    }
  }

  // Find best node for execution
  async findBestNode(
    request: FastifyRequest<{
      Body: {
        capabilities: NodeCapability[];
        excludeNodes?: string[];
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { capabilities, excludeNodes } = request.body;

      if (!capabilities || capabilities.length === 0) {
        reply.code(400);
        return { error: 'At least one capability is required' };
      }

      const node = await this.nodeService.findBestNode(capabilities, excludeNodes);

      if (!node) {
        reply.code(404);
        return { error: 'No available node found matching required capabilities' };
      }

      return {
        success: true,
        data: node,
      };
    } catch (error) {
      logger.error('Failed to find best node', { error: error.message });
      reply.code(500);
      return { error: 'Failed to find best node' };
    }
  }

  // Update node capabilities
  async updateNodeCapabilities(
    request: FastifyRequest<{
      Params: { nodeId: string };
      Body: {
        browsers: Array<{
          name: string;
          version?: string;
          platform?: string;
        }>;
      };
    }>,
    reply: FastifyReply
  ) {
    try {
      const { nodeId } = request.params;
      const { browsers } = request.body;

      // Validate node exists
      const node = await this.nodeService.getNodeById(nodeId);
      if (!node) {
        reply.code(404);
        return { error: 'Node not found' };
      }

      // Validate browsers
      if (!Array.isArray(browsers) || browsers.length === 0) {
        reply.code(400);
        return { error: 'At least one browser capability is required' };
      }

      const updatedNode = await this.nodeService.updateNodeCapabilities(nodeId, browsers);

      logger.info('Node capabilities updated', {
        nodeId,
        newCapabilities: browsers.map(b => b.name),
      });

      return {
        success: true,
        data: updatedNode,
      };
    } catch (error) {
      logger.error('Failed to update node capabilities', {
        nodeId: request.params.nodeId,
        error: error.message,
      });
      reply.code(500);
      return { error: 'Failed to update node capabilities' };
    }
  }

  // Set node to maintenance mode
  async setMaintenanceMode(
    request: FastifyRequest<{ Params: { nodeId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { nodeId } = request.params;

      // Validate node exists
      const node = await this.nodeService.getNodeById(nodeId);
      if (!node) {
        reply.code(404);
        return { error: 'Node not found' };
      }

      await this.nodeService.setNodeMaintenance(nodeId);

      logger.info('Node set to maintenance mode', { nodeId, nodeName: node.name });

      return {
        success: true,
        message: 'Node set to maintenance mode',
      };
    } catch (error) {
      logger.error('Failed to set maintenance mode', {
        nodeId: request.params.nodeId,
        error: error.message,
      });
      reply.code(500);
      return { error: 'Failed to set maintenance mode' };
    }
  }

  // Delete node
  async deleteNode(
    request: FastifyRequest<{ Params: { nodeId: string } }>,
    reply: FastifyReply
  ) {
    try {
      const { nodeId } = request.params;

      await this.nodeService.deleteNode(nodeId);

      logger.info('Node deleted', { nodeId });

      return {
        success: true,
        message: 'Node deleted successfully',
      };
    } catch (error) {
      if (error.message === 'Node not found') {
        reply.code(404);
        return { error: 'Node not found' };
      }

      if (error.message === 'Cannot delete node that is currently busy') {
        reply.code(409);
        return { error: 'Cannot delete node that is currently busy' };
      }

      logger.error('Failed to delete node', {
        nodeId: request.params.nodeId,
        error: error.message,
      });
      reply.code(500);
      return { error: 'Failed to delete node' };
    }
  }

  // Get node statistics
  async getNodeStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const stats = await this.nodeService.getNodeStats();

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      logger.error('Failed to get node stats', { error: error.message });
      reply.code(500);
      return { error: 'Failed to get node statistics' };
    }
  }

  // Get heartbeat monitor status
  async getHeartbeatStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const status = await this.heartbeatMonitor.getStatus();

      return {
        success: true,
        data: status,
      };
    } catch (error) {
      logger.error('Failed to get heartbeat status', { error: error.message });
      reply.code(500);
      return { error: 'Failed to get heartbeat status' };
    }
  }
}