import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { PrismaClient } from '@prisma/client';
import pino from 'pino';

import { config } from '@/config';
import { errorHandler } from '@/middleware/errorHandler';
import { correlationPlugin } from '@/middleware/correlation';
import { logger } from '@/utils/logger';
import { routes } from '@/routes';

// Services
import { redisClient } from '@/libs/redis';
import { s3Client } from '@/libs/s3';
import { QueueService } from '@/libs/queue';
import { WebSocketService } from '@/libs/websocket';
import { ExecutionService } from '@/modules/execution/service';
import { VisualDiffService } from '@/modules/execution/visual-diff-service';
import { AgentController } from '@/modules/agent/controller';

export const createApp = async () => {
  const app = fastify({
    logger: false, // Use our own logger
    trustProxy: true,
    http2: false,
  });

  // Register plugins
  await app.register(cors, {
    origin: config.cors.origin,
    credentials: config.cors.credentials,
  });

  await app.register(helmet, {
    contentSecurityPolicy: false, // Disable for API
  });

  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB
    },
  });

  await app.register(rateLimit, {
    max: config.rateLimit.max,
    timeWindow: config.rateLimit.window,
  });

  // Register JWT
  await app.register(import('@fastify/jwt'), {
    secret: config.jwt.secret,
  });

  // Register Swagger documentation
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'UITrace API',
        description: 'High-performance UI automation testing platform',
        version: '1.0.0',
      },
      servers: [
        {
          url: `http://${config.server.host}:${config.server.port}`,
          description: 'Development server',
        },
      ],
      tags: [
        { name: 'Projects', description: 'Project management' },
        { name: 'Scripts', description: 'Test script management' },
        { name: 'Executions', description: 'Test execution' },
        { name: 'Nodes', description: 'Execution nodes' },
        { name: 'Analytics', description: 'Analytics and reports' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Register correlation tracking plugin
  await app.register(correlationPlugin);

  // Global error handler
  app.setErrorHandler(errorHandler);

  // Register API routes
  app.register(routes, { prefix: '/api/v1' });

  // Initialize database connection
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: config.database.url,
      },
    },
    log: ['query', 'info', 'warn', 'error'],
  });

  // Initialize services
  const queueService = new QueueService();
  const wsService = new WebSocketService(app.server as any);
  const executionService = new ExecutionService(prisma, wsService, queueService);
  const visualDiffService = new VisualDiffService(prisma);
  const agentController = new AgentController(prisma, wsService);

  // Decorate app with services
  app.decorate('prisma', prisma);
  app.decorate('redis', redisClient.getClient());
  app.decorate('s3', s3Client);
  app.decorate('queueService', queueService);
  app.decorate('wsService', wsService);
  app.decorate('executionService', executionService);
  app.decorate('visualDiffService', visualDiffService);
  app.decorate('agentController', agentController);

  // Enhanced health check endpoint
  app.get('/health', async () => {
    const checks = await Promise.allSettled([
      prisma.$queryRaw`SELECT 1`,
      redisClient.getClient()?.ping?.() || Promise.resolve(true),
      queueService.getQueueStats(),
      Promise.resolve(wsService.getConnectedClientsCount() >= 0),
      Promise.resolve({}),
    ]);

    const services = {
      database: checks[0].status === 'fulfilled',
      cache: checks[1].status === 'fulfilled',
      queue: checks[2].status === 'fulfilled',
      websocket: checks[3].status === 'fulfilled',
      storage: checks[4].status === 'fulfilled',
    };

    const allHealthy = Object.values(services).every(Boolean);

    return {
      status: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: config.app.env,
      services,
    };
  });

  // Graceful shutdown
  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, starting graceful shutdown`);

    try {
      await app.close();
      await wsService.close();
      await queueService.close();
      await agentController.shutdown();
      await prisma.$disconnect();
      await redisClient.getClient()?.quit?.();

      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown', { error });
      process.exit(1);
    }
  };

  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', { error });
    gracefulShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled rejection', { reason, promise });
    gracefulShutdown('unhandledRejection');
  });

  return app;
};