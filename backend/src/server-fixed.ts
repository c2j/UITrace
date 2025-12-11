import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';

// Import using relative paths
import { config } from './config/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { correlationPlugin } from './middleware/correlation.js';
import { logger } from './utils/logger.js';
import { routes } from './routes/index.js';
import { redisClient } from './libs/redis.js';
import { s3Client } from './libs/s3.js';
import { QueueService } from './libs/queue.js';
import { WebSocketService } from './libs/websocket.js';
import { ExecutionService } from './modules/execution/service.js';
import { VisualDiffService } from './modules/execution/visual-diff-service.js';
import { AgentController } from './modules/agent/controller.js';

async function start() {
  try {
    const app = fastify({
      logger: false, // Use our own logger
      trustProxy: true,
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
    await app.register(jwt, {
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
            url: `http://${config.app.host}:${config.app.port}`,
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
    await app.register(routes, { prefix: '/api/v1' });

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
    const wsService = new WebSocketService(app.server);
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

    // Start server
    await app.listen({
      port: config.app.port,
      host: config.app.host,
    });

    logger.info(`Server running on http://${config.app.host}:${config.app.port}`);
    logger.info(`API Documentation: http://${config.app.host}:${config.app.port}/docs`);

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

  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Start server
start();