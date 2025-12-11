import { PrismaClient } from '@prisma/client';
import { NodeRepository } from './repository';
import { NodeService } from './service';
import { WebSocketService } from '../../libs/websocket';
import { logger } from '../../utils/logger';

export interface HeartbeatMonitorOptions {
  intervalMs: number; // How often to check for stale nodes
  timeoutMinutes: number; // How long before considering a node stale
}

export class HeartbeatMonitor {
  private interval: NodeJS.Timeout | null = null;
  private options: HeartbeatMonitorOptions;

  constructor(
    private prisma: PrismaClient,
    private nodeRepo: NodeRepository,
    private nodeService: NodeService,
    private wsService: WebSocketService,
    options: Partial<HeartbeatMonitorOptions> = {}
  ) {
    this.options = {
      intervalMs: 30000, // Check every 30 seconds
      timeoutMinutes: 5, // Consider stale after 5 minutes
      ...options,
    };
  }

  start(): void {
    if (this.interval) {
      logger.warn('Heartbeat monitor already started');
      return;
    }

    logger.info('Starting heartbeat monitor', {
      intervalMs: this.options.intervalMs,
      timeoutMinutes: this.options.timeoutMinutes,
    });

    // Run immediately on start
    this.checkStaleNodes();

    // Set up recurring check
    this.interval = setInterval(() => {
      this.checkStaleNodes();
    }, this.options.intervalMs);
  }

  stop(): void {
    if (!this.interval) {
      logger.warn('Heartbeat monitor not running');
      return;
    }

    logger.info('Stopping heartbeat monitor');
    clearInterval(this.interval);
    this.interval = null;
  }

  private async checkStaleNodes(): Promise<void> {
    try {
      const staleNodes = await this.nodeRepo.findStaleNodes(this.options.timeoutMinutes);

      if (staleNodes.length === 0) {
        return;
      }

      logger.warn('Found stale nodes', {
        count: staleNodes.length,
        timeoutMinutes: this.options.timeoutMinutes,
        nodes: staleNodes.map(node => ({
          id: node.id,
          name: node.name,
          lastHeartbeat: node.lastHeartbeat,
        })),
      });

      // Mark stale nodes as offline
      const markedOffline = await this.nodeRepo.markOfflineStaleNodes(this.options.timeoutMinutes);

      if (markedOffline > 0) {
        logger.info('Marked stale nodes as offline', { count: markedOffline });

        // Notify about nodes going offline
        staleNodes.forEach(node => {
          this.wsService.emitNodeStatus(node.id, {
            status: 'OFFLINE',
            lastHeartbeat: node.lastHeartbeat,
            reason: 'heartbeat_timeout',
          });
        });

        // Handle any running executions on these nodes
        await this.handleStaleNodeExecutions(staleNodes);
      }
    } catch (error) {
      logger.error('Error checking stale nodes', { error: error.message });
    }
  }

  private async handleStaleNodeExecutions(staleNodes: any[]): Promise<void> {
    for (const node of staleNodes) {
      if (node.currentExecutionId) {
        logger.warn('Node went offline during execution', {
          nodeId: node.id,
          executionId: node.currentExecutionId,
        });

        // Mark the execution as failed
        try {
          await this.prisma.execution.update({
            where: { id: node.currentExecutionId },
            data: {
              status: 'FAIL',
              endTime: new Date(),
              durationMs: 0, // We don't know the exact duration
            },
          });

          // Log the failure
          await this.prisma.executionLog.create({
            data: {
              executionId: node.currentExecutionId,
              level: 'ERROR',
              message: `Node ${node.name} (${node.id}) went offline during execution`,
              timestamp: new Date(),
            },
          });
        } catch (error) {
          logger.error('Failed to update stale execution', {
            nodeId: node.id,
            executionId: node.currentExecutionId,
            error: error.message,
          });
        }
      }
    }
  }

  async getStatus(): Promise<{
    running: boolean;
    lastCheck?: Date;
    nextCheck?: Date;
    stats: {
      totalNodes: number;
      onlineNodes: number;
      offlineNodes: number;
      staleNodes: number;
    };
  }> {
    const stats = await this.nodeRepo.getNodeStats();
    const staleNodes = await this.nodeRepo.findStaleNodes(this.options.timeoutMinutes);

    return {
      running: this.interval !== null,
      lastCheck: new Date(), // In a real implementation, track the actual last check time
      nextCheck: this.interval ? new Date(Date.now() + this.options.intervalMs) : undefined,
      stats: {
        totalNodes: stats.total,
        onlineNodes: stats.online,
        offlineNodes: stats.offline,
        staleNodes: staleNodes.length,
      },
    };
  }

  updateOptions(options: Partial<HeartbeatMonitorOptions>): void {
    const wasRunning = this.interval !== null;

    if (wasRunning) {
      this.stop();
    }

    this.options = { ...this.options, ...options };

    if (wasRunning) {
      this.start();
    }
  }
}