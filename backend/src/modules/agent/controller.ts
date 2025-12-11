import { FastifyRequest, FastifyReply } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { WebSocketService } from '@/libs/websocket';
import { logger } from '@/utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { AgentRegistrationSchema } from '../execution/schemas';

export interface AgentInfo {
  id: string;
  name: string;
  version: string;
  capabilities: {
    browsers: string[];
    maxConcurrentExecutions: number;
    features?: string[];
  };
  metadata?: Record<string, any>;
  lastHeartbeat: Date;
  status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'MAINTENANCE';
  currentExecutions: string[];
}

export class AgentController {
  private prisma: PrismaClient;
  private wsService: WebSocketService;
  private agents: Map<string, AgentInfo> = new Map();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(prisma: PrismaClient, wsService: WebSocketService) {
    this.prisma = prisma;
    this.wsService = wsService;
    this.startHeartbeatCheck();
  }

  async register(
    request: FastifyRequest<{ Body: AgentRegistrationSchema['body'] }>,
    reply: FastifyReply
  ) {
    const { nodeId, name, version, capabilities, metadata } = request.body;

    try {
      // Generate node ID if not provided
      const agentId = nodeId || uuidv4();

      // Check if agent already exists
      const existingAgent = this.agents.get(agentId);
      if (existingAgent) {
        // Update existing agent
        existingAgent.name = name;
        existingAgent.version = version;
        existingAgent.capabilities = capabilities;
        existingAgent.metadata = metadata || {};
        existingAgent.lastHeartbeat = new Date();
        existingAgent.status = 'ONLINE';

        logger.info('Agent re-registered', {
          nodeId: agentId,
          name,
          version,
        });
      } else {
        // Create new agent
        const agentInfo: AgentInfo = {
          id: agentId,
          name,
          version,
          capabilities,
          metadata: metadata || {},
          lastHeartbeat: new Date(),
          status: 'ONLINE',
          currentExecutions: [],
        };

        this.agents.set(agentId, agentInfo);

        // Create node record in database
        await this.prisma.node.upsert({
          where: { id: agentId },
          update: {
            name,
            version,
            status: 'ONLINE',
            lastHeartbeat: new Date(),
            metadata: metadata || {},
          },
          create: {
            id: agentId,
            name,
            version,
            status: 'ONLINE',
            lastHeartbeat: new Date(),
            metadata: metadata || {},
          },
        });

        logger.info('Agent registered', {
          nodeId: agentId,
          name,
          version,
          capabilities,
        });
      }

      // Emit node status update
      this.wsService.emitNodeStatus(agentId, 'ONLINE');

      return reply.status(201).send({
        success: true,
        data: {
          nodeId: agentId,
          status: 'registered',
          message: 'Agent registered successfully',
        },
      });
    } catch (error: any) {
      logger.error('Failed to register agent', {
        nodeId,
        error: error.message,
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to register agent',
      });
    }
  }

  async handleAgentHeartbeat(
    request: FastifyRequest<{
      Params: { nodeId: string };
      Body: {
        status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'MAINTENANCE';
        currentExecutions?: string[];
        metadata?: Record<string, any>;
      };
    }>,
    reply: FastifyReply
  ) {
    const { nodeId } = request.params;
    const { status, currentExecutions, metadata } = request.body;

    try {
      const agent = this.agents.get(nodeId);
      if (!agent) {
        return reply.status(404).send({
          success: false,
          error: 'Agent not found',
        });
      }

      // Update agent info
      agent.lastHeartbeat = new Date();
      agent.status = status;
      agent.currentExecutions = currentExecutions || [];
      if (metadata) {
        agent.metadata = { ...agent.metadata, ...metadata };
      }

      // Update database
      await this.prisma.node.update({
        where: { id: nodeId },
        data: {
          status,
          lastHeartbeat: new Date(),
          metadata: agent.metadata,
        },
      });

      // Emit status update
      this.wsService.emitNodeStatus(nodeId, status);

      logger.debug('Agent heartbeat received', {
        nodeId,
        status,
        currentExecutions: currentExecutions?.length,
      });

      return reply.send({
        success: true,
        data: {
          nodeId,
          status: 'updated',
          lastHeartbeat: agent.lastHeartbeat,
        },
      });
    } catch (error: any) {
      logger.error('Failed to handle agent heartbeat', {
        nodeId,
        error: error.message,
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to update agent status',
      });
    }
  }

  async deregister(
    request: FastifyRequest<{ Params: { nodeId: string } }>,
    reply: FastifyReply
  ) {
    const { nodeId } = request.params;

    try {
      const agent = this.agents.get(nodeId);
      if (!agent) {
        return reply.status(404).send({
          success: false,
          error: 'Agent not found',
        });
      }

      // Remove from memory
      this.agents.delete(nodeId);

      // Update database
      await this.prisma.node.update({
        where: { id: nodeId },
        data: {
          status: 'OFFLINE',
          lastHeartbeat: new Date(),
        },
      });

      // Emit status update
      this.wsService.emitNodeStatus(nodeId, 'OFFLINE');

      logger.info('Agent deregistered', { nodeId });

      return reply.send({
        success: true,
        message: 'Agent deregistered successfully',
      });
    } catch (error: any) {
      logger.error('Failed to deregister agent', {
        nodeId,
        error: error.message,
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to deregister agent',
      });
    }
  }

  async getAgents(
    request: FastifyRequest<{
      Querystring: {
        status?: string;
        capability?: string;
        page?: string;
        limit?: string;
      };
    }>,
    reply: FastifyReply
  ) {
    const { status, capability, page = '1', limit = '50' } = request.query;

    try {
      let agents = Array.from(this.agents.values());

      // Filter by status
      if (status) {
        agents = agents.filter(agent => agent.status === status);
      }

      // Filter by capability
      if (capability) {
        agents = agents.filter(agent =>
          agent.capabilities.browsers.includes(capability) ||
          agent.capabilities.features?.includes(capability)
        );
      }

      // Pagination
      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;

      const paginatedAgents = agents.slice(startIndex, endIndex);

      return reply.send({
        success: true,
        data: {
          agents: paginatedAgents.map(agent => ({
            id: agent.id,
            name: agent.name,
            version: agent.version,
            status: agent.status,
            capabilities: agent.capabilities,
            metadata: agent.metadata,
            lastHeartbeat: agent.lastHeartbeat,
            currentExecutions: agent.currentExecutions.length,
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: agents.length,
            totalPages: Math.ceil(agents.length / limitNum),
          },
        },
      });
    } catch (error: any) {
      logger.error('Failed to get agents', { error: error.message });

      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve agents',
      });
    }
  }

  async getAgent(
    request: FastifyRequest<{ Params: { nodeId: string } }>,
    reply: FastifyReply
  ) {
    const { nodeId } = request.params;

    try {
      const agent = this.agents.get(nodeId);
      if (!agent) {
        return reply.status(404).send({
          success: false,
          error: 'Agent not found',
        });
      }

      // Get execution details for current executions
      const executions = await this.prisma.execution.findMany({
        where: {
          id: { in: agent.currentExecutions },
        },
        select: {
          id: true,
          status: true,
          scriptId: true,
          startTime: true,
        },
      });

      return reply.send({
        success: true,
        data: {
          ...agent,
          currentExecutions: executions,
        },
      });
    } catch (error: any) {
      logger.error('Failed to get agent', {
        nodeId,
        error: error.message,
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve agent',
      });
    }
  }

  getAgentInfo(nodeId: string): AgentInfo | undefined {
    return this.agents.get(nodeId);
  }

  getAllAgents(): AgentInfo[] {
    return Array.from(this.agents.values());
  }

  getAvailableAgents(browser?: string): AgentInfo[] {
    let agents = Array.from(this.agents.values()).filter(
      agent => agent.status === 'ONLINE' && agent.currentExecutions.length < agent.capabilities.maxConcurrentExecutions
    );

    if (browser) {
      agents = agents.filter(agent =>
        agent.capabilities.browsers.includes(browser)
      );
    }

    return agents;
  }

  assignExecution(nodeId: string, executionId: string): boolean {
    const agent = this.agents.get(nodeId);
    if (!agent || agent.status !== 'ONLINE' || agent.currentExecutions.length >= agent.capabilities.maxConcurrentExecutions) {
      return false;
    }

    agent.currentExecutions.push(executionId);
    if (agent.currentExecutions.length >= agent.capabilities.maxConcurrentExecutions) {
      agent.status = 'BUSY';
    }

    return true;
  }

  removeExecution(nodeId: string, executionId: string): boolean {
    const agent = this.agents.get(nodeId);
    if (!agent) {
      return false;
    }

    const index = agent.currentExecutions.indexOf(executionId);
    if (index > -1) {
      agent.currentExecutions.splice(index, 1);
      if (agent.status === 'BUSY' && agent.currentExecutions.length < agent.capabilities.maxConcurrentExecutions) {
        agent.status = 'ONLINE';
      }
      return true;
    }

    return false;
  }

  private startHeartbeatCheck(): void {
    // Check for stale agents every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      const staleTimeout = 60 * 1000; // 60 seconds

      for (const [nodeId, agent] of this.agents.entries()) {
        if (now.getTime() - agent.lastHeartbeat.getTime() > staleTimeout) {
          // Mark agent as offline
          agent.status = 'OFFLINE';
          agent.currentExecutions = [];

          // Update database
          this.prisma.node.update({
            where: { id: nodeId },
            data: {
              status: 'OFFLINE',
              lastHeartbeat: now,
            },
          }).catch(error => {
            logger.error('Failed to update node status', {
              nodeId,
              error: error.message,
            });
          });

          // Emit status update
          this.wsService.emitNodeStatus(nodeId, 'OFFLINE');

          logger.warn('Agent marked as offline due to missed heartbeats', {
            nodeId,
            lastHeartbeat: agent.lastHeartbeat,
          });
        }
      }
    }, 30000);
  }

  async shutdown(): Promise<void> {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Mark all agents as offline
    for (const [nodeId, agent] of this.agents.entries()) {
      agent.status = 'OFFLINE';
      await this.prisma.node.update({
        where: { id: nodeId },
        data: {
          status: 'OFFLINE',
          lastHeartbeat: new Date(),
        },
      });

      this.wsService.emitNodeStatus(nodeId, 'OFFLINE');
    }

    logger.info('Agent controller shutdown complete');
  }
}