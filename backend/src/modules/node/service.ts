import { PrismaClient, ServerNode, NodeStatus, BrowserCapability } from '@prisma/client';
import { NodeRepository } from './repository';
import { logger } from '../../utils/logger';
import { WebSocketService } from '../../libs/websocket';

export interface NodeRegistrationData {
  name: string;
  ip: string;
  os: string;
  browsers: BrowserCapability[];
  hardwareStats?: {
    cpu: number;
    memory: number;
    disk: number;
  };
}

export interface NodeCapability {
  browser: string;
  version?: string;
  platform?: string;
}

export class NodeService {
  constructor(
    private prisma: PrismaClient,
    private nodeRepo: NodeRepository,
    private wsService: WebSocketService
  ) {}

  async registerNode(data: NodeRegistrationData): Promise<ServerNode> {
    logger.info('Registering new node', { name: data.name, ip: data.ip });

    // Check if node with same IP already exists
    const existingNode = await this.nodeRepo.findByIp(data.ip);

    if (existingNode) {
      // Update existing node
      logger.info('Updating existing node', { nodeId: existingNode.id });
      const updatedNode = await this.nodeRepo.update(existingNode.id, {
        name: data.name,
        os: data.os,
        browsers: data.browsers,
        hardwareStats: data.hardwareStats,
        status: 'ONLINE',
      });

      // Notify about node reconnection
      this.wsService.emitNodeStatus(updatedNode.id, {
        status: 'ONLINE',
        lastHeartbeat: new Date(),
      });

      return updatedNode;
    }

    // Create new node
    const newNode = await this.nodeRepo.create({
      name: data.name,
      ip: data.ip,
      os: data.os,
      browsers: data.browsers,
      hardwareStats: data.hardwareStats,
      status: 'ONLINE',
    });

    logger.info('Node registered successfully', { nodeId: newNode.id });

    // Notify about new node
    this.wsService.emitNodeStatus(newNode.id, {
      status: 'ONLINE',
      lastHeartbeat: new Date(),
    });

    return newNode;
  }

  async updateNodeHeartbeat(nodeId: string, hardwareStats?: {
    cpu: number;
    memory: number;
    disk: number;
  }): Promise<void> {
    await this.nodeRepo.updateLastHeartbeat(nodeId);

    if (hardwareStats) {
      await this.nodeRepo.updateHardwareStats(nodeId, hardwareStats);
    }
  }

  async findBestNode(
    requiredCapabilities: NodeCapability[],
    excludeNodes?: string[]
  ): Promise<ServerNode | null> {
    const capabilityNames = requiredCapabilities.map(cap => cap.browser.toLowerCase());

    const availableNodes = await this.nodeRepo.findAvailableNodes(capabilityNames);

    // Filter out excluded nodes
    const filteredNodes = availableNodes.filter(
      node => !excludeNodes?.includes(node.id)
    );

    if (filteredNodes.length === 0) {
      logger.warn('No available nodes found for required capabilities', {
        requiredCapabilities,
      });
      return null;
    }

    // Simple selection: choose the node with the lowest load
    // In a more sophisticated implementation, we could consider:
    // - Hardware specs
    // - Current execution count
    // - Network latency
    // - Past success rate

    const bestNode = filteredNodes.sort((a, b) => {
      // Prefer nodes with fewer active executions
      const aExecutions = a.currentExecutionId ? 1 : 0;
      const bExecutions = b.currentExecutionId ? 1 : 0;

      if (aExecutions !== bExecutions) {
        return aExecutions - bExecutions;
      }

      // Then by most recent heartbeat
      return b.lastHeartbeat.getTime() - a.lastHeartbeat.getTime();
    })[0];

    logger.info('Selected best node for execution', {
      nodeId: bestNode.id,
      nodeName: bestNode.name,
      capabilities: requiredCapabilities,
    });

    return bestNode;
  }

  async markNodeBusy(nodeId: string): Promise<void> {
    await this.nodeRepo.updateStatus(nodeId, 'BUSY');

    this.wsService.emitNodeStatus(nodeId, {
      status: 'BUSY',
      lastHeartbeat: new Date(),
    });
  }

  async markNodeAvailable(nodeId: string): Promise<void> {
    await this.nodeRepo.updateStatus(nodeId, 'ONLINE');

    this.wsService.emitNodeStatus(nodeId, {
      status: 'ONLINE',
      lastHeartbeat: new Date(),
    });
  }

  async markNodeOffline(nodeId: string): Promise<void> {
    await this.nodeRepo.updateStatus(nodeId, 'OFFLINE');

    this.wsService.emitNodeStatus(nodeId, {
      status: 'OFFLINE',
      lastHeartbeat: new Date(),
    });
  }

  async getNodeById(nodeId: string): Promise<ServerNode | null> {
    return this.nodeRepo.findById(nodeId);
  }

  async getAllNodes(options?: {
    status?: NodeStatus;
    page?: number;
    limit?: number;
  }) {
    return this.nodeRepo.findAll(options);
  }

  async deleteNode(nodeId: string): Promise<void> {
    const node = await this.nodeRepo.findById(nodeId);

    if (!node) {
      throw new Error('Node not found');
    }

    if (node.status === 'BUSY' || node.currentExecutionId) {
      throw new Error('Cannot delete node that is currently busy');
    }

    await this.nodeRepo.delete(nodeId);

    logger.info('Node deleted', { nodeId, nodeName: node.name });

    this.wsService.emitNodeStatus(nodeId, {
      status: 'DELETED',
      lastHeartbeat: new Date(),
    });
  }

  async setNodeMaintenance(nodeId: string): Promise<void> {
    await this.nodeRepo.updateStatus(nodeId, 'MAINTENANCE');

    this.wsService.emitNodeStatus(nodeId, {
      status: 'MAINTENANCE',
      lastHeartbeat: new Date(),
    });
  }

  async getNodeStats(): Promise<{
    total: number;
    online: number;
    offline: number;
    busy: number;
    maintenance: number;
  }> {
    return this.nodeRepo.getNodeStats();
  }

  async checkNodeCapabilities(
    nodeId: string,
    requiredCapabilities: NodeCapability[]
  ): Promise<boolean> {
    const node = await this.nodeRepo.findById(nodeId);

    if (!node || node.status !== 'ONLINE') {
      return false;
    }

    const nodeBrowserNames = node.browsers.map(b => b.name.toLowerCase());
    const requiredBrowserNames = requiredCapabilities.map(cap => cap.browser.toLowerCase());

    // Check if all required browsers are available
    return requiredBrowserNames.every(browser => nodeBrowserNames.includes(browser));
  }

  async updateNodeCapabilities(
    nodeId: string,
    browsers: BrowserCapability[]
  ): Promise<ServerNode> {
    const node = await this.nodeRepo.update(nodeId, { browsers });

    logger.info('Node capabilities updated', {
      nodeId,
      newCapabilities: browsers.map(b => b.name),
    });

    return node;
  }
}