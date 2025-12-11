import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from '@fastify/jwt';
import { config } from '@/config';
import { logger } from '@/utils/logger';
import {
  ExecutionUpdateMessage,
  LogMessage,
  NodeStatusMessage,
  WebSocketMessage
} from '@/types';

export interface ClientSubscription {
  socketId: string;
  userId?: string;
  executionIds: string[];
  nodeIds: string[];
}

export class WebSocketService {
  private io: SocketIOServer;
  private subscriptions: Map<string, ClientSubscription> = new Map();

  constructor(httpServer: HttpServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: config.websocket.corsOrigin,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    });

    this.setupEventHandlers();
    this.setupPeriodicTasks();
  }

  private setupEventHandlers(): void {
    this.io.on('connection', (socket: Socket) => {
      logger.info('WebSocket client connected', { socketId: socket.id });

      // Skip authentication in development and test environments
      if (config.app.env !== 'development' && config.app.env !== 'test') {
        // Verify authentication token from query parameters (only in production)
        const token = socket.handshake.auth?.token || socket.handshake.query?.token;
        if (!token || typeof token !== 'string') {
          logger.warn('WebSocket connection rejected: No authentication token', { socketId: socket.id });
          socket.emit('error', {
            type: 'auth_error',
            message: 'Authentication Required',
          });
          socket.disconnect(true);
          return;
        }

        // Verify JWT token
        try {
          const decoded = jwt.verify(token, config.jwt.secret);
          logger.debug('WebSocket authentication successful', { socketId: socket.id, userId: (decoded as any).sub });
        } catch (err) {
          logger.warn('WebSocket connection rejected: Invalid token', { socketId: socket.id, error: err });
          socket.emit('error', {
            type: 'auth_error',
            message: 'Authentication Required',
          });
          socket.disconnect(true);
          return;
        }
      } else {
        logger.debug('WebSocket authentication skipped in development mode', { socketId: socket.id });
      }

      // Initialize subscription for this client
      this.subscriptions.set(socket.id, {
        socketId: socket.id,
        executionIds: [],
        nodeIds: [],
      });

      // Send welcome message
      socket.emit('connected', {
        type: 'connection',
        data: {
          message: 'Connected to UITrace WebSocket server',
          socketId: socket.id,
          timestamp: new Date().toISOString(),
        },
      });

      // Handle client subscriptions
      socket.on('subscribe_execution', (data: { executionId: string }) => {
        this.handleExecutionSubscription(socket, data.executionId);
      });

      socket.on('unsubscribe_execution', (data: { executionId: string }) => {
        this.handleExecutionUnsubscription(socket, data.executionId);
      });

      socket.on('subscribe_node', (data: { nodeId: string }) => {
        this.handleNodeSubscription(socket, data.nodeId);
      });

      socket.on('unsubscribe_node', (data: { nodeId: string }) => {
        this.handleNodeUnsubscription(socket, data.nodeId);
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info('WebSocket client disconnected', {
          socketId: socket.id,
          reason
        });
        this.subscriptions.delete(socket.id);
      });
    });
  }

  private handleExecutionSubscription(socket: Socket, executionId: string): void {
    const subscription = this.subscriptions.get(socket.id);
    if (!subscription) return;

    // Join execution room for targeted broadcasts
    socket.join(`execution:${executionId}`);

    // Add to subscription tracking
    if (!subscription.executionIds.includes(executionId)) {
      subscription.executionIds.push(executionId);
    }

    logger.debug('Client subscribed to execution', {
      socketId: socket.id,
      executionId,
    });

    // Acknowledge subscription
    socket.emit('subscription_confirmed', {
      type: 'subscription',
      data: {
        type: 'execution',
        id: executionId,
        subscribed: true,
      },
    });
  }

  private handleExecutionUnsubscription(socket: Socket, executionId: string): void {
    const subscription = this.subscriptions.get(socket.id);
    if (!subscription) return;

    // Leave execution room
    socket.leave(`execution:${executionId}`);

    // Remove from subscription tracking
    const index = subscription.executionIds.indexOf(executionId);
    if (index > -1) {
      subscription.executionIds.splice(index, 1);
    }

    logger.debug('Client unsubscribed from execution', {
      socketId: socket.id,
      executionId,
    });

    // Acknowledge unsubscription
    socket.emit('subscription_confirmed', {
      type: 'subscription',
      data: {
        type: 'execution',
        id: executionId,
        subscribed: false,
      },
    });
  }

  private handleNodeSubscription(socket: Socket, nodeId: string): void {
    const subscription = this.subscriptions.get(socket.id);
    if (!subscription) return;

    // Join node room for targeted broadcasts
    socket.join(`node:${nodeId}`);

    // Add to subscription tracking
    if (!subscription.nodeIds.includes(nodeId)) {
      subscription.nodeIds.push(nodeId);
    }

    logger.debug('Client subscribed to node', {
      socketId: socket.id,
      nodeId,
    });

    // Acknowledge subscription
    socket.emit('subscription_confirmed', {
      type: 'subscription',
      data: {
        type: 'node',
        id: nodeId,
        subscribed: true,
      },
    });
  }

  private handleNodeUnsubscription(socket: Socket, nodeId: string): void {
    const subscription = this.subscriptions.get(socket.id);
    if (!subscription) return;

    // Leave node room
    socket.leave(`node:${nodeId}`);

    // Remove from subscription tracking
    const index = subscription.nodeIds.indexOf(nodeId);
    if (index > -1) {
      subscription.nodeIds.splice(index, 1);
    }

    logger.debug('Client unsubscribed from node', {
      socketId: socket.id,
      nodeId,
    });

    // Acknowledge unsubscription
    socket.emit('subscription_confirmed', {
      type: 'subscription',
      data: {
        type: 'node',
        id: nodeId,
        subscribed: false,
      },
    });
  }

  emitExecutionUpdate(executionId: string, update: Partial<ExecutionUpdateMessage['data']>): void {
    const message: ExecutionUpdateMessage = {
      type: 'execution_update',
      data: {
        executionId,
        status: 'PENDING',
        progress: 0,
        stepIndex: 0,
        message: '',
        ...update,
      },
      timestamp: new Date().toISOString(),
    };

    // Send to execution-specific room
    this.io.to(`execution:${executionId}`).emit('execution_update', message);
  }

  emitLogMessage(executionId: string, logData: {
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    message: string;
    stepId?: number;
  }): void {
    const message: LogMessage = {
      type: 'log',
      data: {
        executionId,
        level: logData.level,
        message: logData.message,
        stepId: logData.stepId,
      },
      timestamp: new Date().toISOString(),
    };

    // Send to execution-specific room
    this.io.to(`execution:${executionId}`).emit('log', message);
  }

  emitNodeStatus(nodeId: string, status: 'ONLINE' | 'OFFLINE' | 'BUSY' | 'MAINTENANCE'): void {
    const message: NodeStatusMessage = {
      type: 'node_status',
      data: {
        nodeId,
        status,
        lastHeartbeat: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    };

    // Send to node-specific room
    this.io.to(`node:${nodeId}`).emit('node_status', message);
  }

  broadcastToAll(message: WebSocketMessage): void {
    this.io.emit(message.type, message);
  }

  private broadcastToSubscribers(type: 'execution' | 'node', id: string, message: WebSocketMessage): void {
    this.subscriptions.forEach((subscription) => {
      const subscribedIds = type === 'execution'
        ? subscription.executionIds
        : subscription.nodeIds;

      if (subscribedIds.includes(id)) {
        this.io.to(subscription.socketId).emit(message.type, message);
      }
    });
  }

  getConnectedClientsCount(): number {
    return this.io.sockets.sockets.size;
  }

  getSubscriptionStats(): {
    totalClients: number;
    executionSubscriptions: Map<string, number>;
    nodeSubscriptions: Map<string, number>;
  } {
    const executionSubs = new Map<string, number>();
    const nodeSubs = new Map<string, number>();

    this.subscriptions.forEach((subscription) => {
      subscription.executionIds.forEach(executionId => {
        executionSubs.set(
          executionId,
          (executionSubs.get(executionId) || 0) + 1
        );
      });

      subscription.nodeIds.forEach(nodeId => {
        nodeSubs.set(
          nodeId,
          (nodeSubs.get(nodeId) || 0) + 1
        );
      });
    });

    return {
      totalClients: this.subscriptions.size,
      executionSubs,
      nodeSubs,
    };
  }

  private setupPeriodicTasks(): void {
    // Send periodic stats to monitoring dashboard (if connected)
    setInterval(() => {
      const stats = this.getSubscriptionStats();
      if (stats.totalClients > 0) {
        this.broadcastToAll({
          type: 'stats',
          data: {
            connectedClients: stats.totalClients,
            executionSubscriptions: Object.fromEntries(stats.executionSubs),
            nodeSubscriptions: Object.fromEntries(stats.nodeSubscriptions),
            timestamp: new Date().toISOString(),
          },
        });
      }
    }, 30000); // Every 30 seconds

    // Clean up stale subscriptions (optional)
    setInterval(() => {
      this.cleanupStaleSubscriptions();
    }, 300000); // Every 5 minutes
  }

  private cleanupStaleSubscriptions(): void {
    const now = Date.now();
    const staleTimeout = 5 * 60 * 1000; // 5 minutes

    // This is a simplified cleanup - in a real implementation,
    // you'd track last activity per socket
    for (const [socketId, subscription] of this.subscriptions.entries()) {
      // Check if socket is still connected
      const socket = this.io.sockets.sockets.get(socketId);
      if (!socket) {
        this.subscriptions.delete(socketId);
        logger.debug('Cleaned up stale subscription', { socketId });
      }
    }
  }

  // Emit system-wide notifications
  emitSystemNotification(notification: {
    type: 'info' | 'warning' | 'error';
    title: string;
    message: string;
    data?: any;
  }): void {
    this.broadcastToAll({
      type: 'system_notification',
      data: {
        ...notification,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Queue status updates
  emitQueueStatus(status: {
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }): void {
    this.broadcastToAll({
      type: 'queue_status',
      data: {
        ...status,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Handle agent connection from execution nodes
  handleAgentConnection(socket: Socket, nodeId: string): void {
    // Join agent-specific room
    socket.join(`agent:${nodeId}`);

    logger.info('Agent connected', {
      nodeId,
      socketId: socket.id,
    });

    // Update node status to ONLINE
    this.emitNodeStatus(nodeId, 'ONLINE');

    // Handle agent disconnection
    socket.on('disconnect', () => {
      logger.info('Agent disconnected', {
        nodeId,
        socketId: socket.id,
      });

      // Mark node as OFFLINE after a grace period
      setTimeout(() => {
        // Check if agent reconnected
        const agentRoom = this.io.sockets.adapter.rooms.get(`agent:${nodeId}`);
        if (!agentRoom || agentRoom.size === 0) {
          this.emitNodeStatus(nodeId, 'OFFLINE');
        }
      }, 10000); // 10 second grace period
    });

    // Handle agent status updates
    socket.on('status_update', (data) => {
      this.emitNodeStatus(nodeId, data.status);
    });

    // Handle agent logs
    socket.on('agent_log', (data) => {
      logger.debug('Agent log', { nodeId, ...data });
    });
  }

  // Get server instance for external use
  getServer(): SocketIOServer {
    return this.io;
  }

  // Graceful shutdown
  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.io.close(() => {
        logger.info('WebSocket server closed');
        resolve();
      });
    });
  }
}