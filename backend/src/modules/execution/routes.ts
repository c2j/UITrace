import { FastifyInstance, FastifyPluginOptions, FastifyRequest, FastifyReply } from 'fastify';
import { ExecutionController } from './controller';
import { ExecutionSchemas } from './schemas';
import { ExecutionService } from './service';
import { VisualDiffService } from './visual-diff-service';
import { AgentController } from '@/modules/agent/controller';
import { authenticate } from '@/middleware/auth';

export async function executionRoutes(
  fastify: FastifyInstance,
  options: FastifyPluginOptions
) {
  // Initialize services
  const executionService = new ExecutionService(
    fastify.prisma,
    fastify.wsService,
    fastify.queueService
  );
  const visualDiffService = new VisualDiffService(fastify.prisma);
  const agentController = new AgentController(fastify.prisma, fastify.wsService);

  const executionController = new ExecutionController(
    executionService,
    visualDiffService
  );

  // Public routes (no authentication required for agent endpoints)
  const publicRoutes = [
    // Agent registration
    {
      method: 'POST' as const,
      url: '/agents/register',
      handler: agentController.register.bind(agentController),
      schema: ExecutionSchemas.AgentRegistrationSchema,
    },
  ];

  // Protected routes (authentication required)
  const protectedRoutes = [
    // Script execution
    {
      method: 'POST' as const,
      url: '/scripts/:scriptId/run',
      handler: executionController.runScript.bind(executionController),
      schema: ExecutionSchemas.CreateExecutionSchema,
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 minute',
        },
      },
    },
    {
      method: 'GET' as const,
      url: '/executions/:executionId',
      handler: executionController.getExecution.bind(executionController),
      schema: ExecutionSchemas.GetExecutionSchema,
    },
    {
      method: 'PUT' as const,
      url: '/executions/:executionId',
      handler: executionController.updateExecution.bind(executionController),
      schema: ExecutionSchemas.UpdateExecutionSchema,
    },
    {
      method: 'GET' as const,
      url: '/executions',
      handler: executionController.getExecutions.bind(executionController),
      schema: ExecutionSchemas.GetExecutionsSchema,
    },
    {
      method: 'POST' as const,
      url: '/executions/:executionId/stop',
      handler: executionController.stopExecution.bind(executionController),
      schema: ExecutionSchemas.StopExecutionSchema,
    },
    {
      method: 'POST' as const,
      url: '/executions/:executionId/retry',
      handler: executionController.retryExecution.bind(executionController),
      schema: ExecutionSchemas.RetryExecutionSchema,
    },
    {
      method: 'DELETE' as const,
      url: '/executions/:executionId/cancel',
      handler: executionController.cancelExecution.bind(executionController),
    },
    {
      method: 'GET' as const,
      url: '/executions/:executionId/logs',
      handler: executionController.getExecutionLogs.bind(executionController),
      schema: ExecutionSchemas.GetExecutionLogsSchema,
    },
    {
      method: 'GET' as const,
      url: '/executions/:executionId/visual-diffs',
      handler: executionController.getVisualDiffs.bind(executionController),
    },
    {
      method: 'GET' as const,
      url: '/executions/:executionId/report',
      handler: executionController.getExecutionReport.bind(executionController),
    },

    // Visual diff management
    {
      method: 'PUT' as const,
      url: '/visual-diffs/:diffId/approve',
      handler: executionController.approveVisualDiff.bind(executionController),
      schema: ExecutionSchemas.ApproveDiffSchema,
    },
    {
      method: 'GET' as const,
      url: '/visual-diffs/:diffId/heatmap',
      handler: executionController.getDiffHeatmap.bind(executionController),
    },

    // Statistics and analytics
    {
      method: 'GET' as const,
      url: '/executions/stats',
      handler: executionController.getExecutionStats.bind(executionController),
    },
    {
      method: 'GET' as const,
      url: '/executions/recent',
      handler: executionController.getRecentExecutions.bind(executionController),
    },
  ];

  // Register public routes
  publicRoutes.forEach(route => {
    fastify.route({
      method: route.method,
      url: route.url,
      handler: route.handler,
      schema: route.schema,
      config: route.config || {},
    });
  });

  // Register protected routes with authentication
  protectedRoutes.forEach(route => {
    fastify.route({
      method: route.method,
      url: route.url,
      preHandler: [authenticate],
      handler: route.handler,
      schema: route.schema,
      config: route.config || {},
    });
  });

  // WebSocket endpoint info
  fastify.get('/websocket', {
    schema: {
      description: 'WebSocket connection information',
      tags: ['WebSocket'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                url: { type: 'string' },
                protocols: {
                  type: 'array',
                  items: { type: 'string' },
                },
                events: {
                  type: 'object',
                  properties: {
                    execution_update: {
                      type: 'object',
                      properties: {
                        description: { type: 'string' },
                        schema: { type: 'string' },
                      },
                    },
                    log: {
                      type: 'object',
                      properties: {
                        description: { type: 'string' },
                        schema: { type: 'string' },
                      },
                    },
                    node_status: {
                      type: 'object',
                      properties: {
                        description: { type: 'string' },
                        schema: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      return reply.send({
        success: true,
        data: {
          url: `ws://${request.headers.host}/ws`,
          protocols: ['websocket'],
          events: {
            execution_update: {
              description: 'Real-time execution progress updates',
              schema: 'ExecutionUpdateMessage',
            },
            log: {
              description: 'Real-time execution logs',
              schema: 'LogMessage',
            },
            node_status: {
              description: 'Agent node status updates',
              schema: 'NodeStatusMessage',
            },
          },
        },
      });
    },
  });

  // Health check for execution services
  fastify.get('/health', {
    schema: {
      description: 'Health check for execution services',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                status: { type: 'string' },
                services: {
                  type: 'object',
                  properties: {
                    execution: { type: 'boolean' },
                    queue: { type: 'boolean' },
                    websocket: { type: 'boolean' },
                    storage: { type: 'boolean' },
                    database: { type: 'boolean' },
                  },
                },
                timestamp: { type: 'string' },
              },
            },
          },
        },
      },
    },
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      const checks = await Promise.allSettled([
        // Database check
        fastify.prisma.$queryRaw`SELECT 1`,
        // Redis check
        fastify.redis?.ping?.() || Promise.resolve(true),
        // Queue service check
        fastify.queueService?.getQueueStats?.() || Promise.resolve({}),
        // WebSocket service check
        Promise.resolve(fastify.wsService?.getConnectedClientsCount?.() >= 0),
        // S3 check
        s3Client?.listBuckets?.() || Promise.resolve({}),
      ]);

      const services = {
        database: checks[0].status === 'fulfilled',
        cache: checks[1].status === 'fulfilled',
        queue: checks[2].status === 'fulfilled',
        websocket: checks[3].status === 'fulfilled',
        storage: checks[4].status === 'fulfilled',
      };

      const allHealthy = Object.values(services).every(Boolean);

      const statusCode = allHealthy ? 200 : 503;

      return reply.status(statusCode).send({
        success: allHealthy,
        data: {
          status: allHealthy ? 'healthy' : 'degraded',
          services,
          timestamp: new Date().toISOString(),
        },
      });
    },
  });

  // OpenAPI documentation tags
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    reply.header('X-API-Version', '1.0.0');
  });

  // Rate limiting for sensitive endpoints
  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip rate limiting for WebSocket and health endpoints
    if (request.url.startsWith('/ws') || request.url === '/health') {
      return;
    }
  });
}

export default executionRoutes;