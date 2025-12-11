import fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import { PrismaClient } from '@prisma/client';
import { redisClient } from './libs/redis.js';
import { WebSocketService } from './libs/websocket.js';

// Import routes
import { projectRoutes } from './routes/projects.js';
import { scriptRoutes } from './routes/scripts.js';

// Simple JWT auth middleware
const authMiddleware = async (request: any, reply: any) => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
};

// Start server
async function start() {
  // Initialize Prisma
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/uitrace',
      },
    },
    log: ['warn', 'error'],
  });

  // Initialize services
  const wsService = new WebSocketService();

  const app = fastify({
    logger: false,
  });

  // Register plugins
  await app.register(cors, {
    origin: ['http://localhost:3001', 'http://localhost:3000'],
    credentials: true,
  });

  await app.register(multipart);

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'your-secret-key',
  });

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  app.get('/api/v1/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // API Routes
  app.register(async (fastify) => {
    // Public routes
    fastify.get('/', async () => {
      return {
        message: 'UITrace Backend API v2',
        version: '2.0.0',
        endpoints: {
          projects: '/api/v1/projects',
          scripts: '/api/v1/scripts',
          executions: '/api/v1/executions',
        },
      };
    });

    // Auth routes
    fastify.post('/auth/login', async (request, reply) => {
      // Simple auth for demo
      const { username, password } = request.body as any;

      if (username === 'admin' && password === 'admin') {
        const token = app.jwt.sign({
          sub: '1',
          name: 'Admin User',
          role: 'admin',
        });

        return { token, user: { id: '1', name: 'Admin User', role: 'admin' } };
      }

      reply.code(401);
      return { error: 'Invalid credentials' };
    });

    // Protected routes
    fastify.register(async (fastify) => {
      // Add auth middleware to all protected routes
      fastify.addHook('onRequest', authMiddleware);

      // Projects
      fastify.get('/projects', async (request, reply) => {
        const projects = await prisma.project.findMany({
          include: {
            versions: {
              include: {
                modules: {
                  include: {
                    _count: {
                      select: { scripts: true }
                    }
                  }
                }
              }
            }
          }
        });

        return {
          success: true,
          data: projects.map(p => ({
            ...p,
            versions: p.versions.map(v => ({
              ...v,
              stats: {
                totalScripts: v.modules.reduce((sum, m) => sum + m._count.scripts, 0),
                passRate: 85 + Math.floor(Math.random() * 10), // Mock data
                coverage: 75 + Math.floor(Math.random() * 20),
              }
            }))
          }))
        };
      });

      fastify.post('/projects', async (request, reply) => {
        const { name, icon } = request.body as any;

        // Check if project with same name exists
        const existing = await prisma.project.findFirst({ where: { name } });
        if (existing) {
          reply.code(409);
          return { error: 'Project with this name already exists' };
        }

        const project = await prisma.project.create({
          data: { name, icon: icon || 'folder' },
          include: {
            versions: true
          }
        });

        return { success: true, data: project };
      });

      fastify.get('/projects/:id', async (request, reply) => {
        const { id } = request.params as any;
        const project = await prisma.project.findUnique({
          where: { id },
          include: {
            versions: true
          }
        });

        if (!project) {
          reply.code(404);
          return { error: 'Project not found' };
        }

        return { success: true, data: project };
      });

      fastify.put('/projects/:id', async (request, reply) => {
        const { id } = request.params as any;
        const { name, icon } = request.body as any;

        // Check if project exists
        const existing = await prisma.project.findUnique({ where: { id } });
        if (!existing) {
          reply.code(404);
          return { error: 'Project not found' };
        }

        // Check if name conflicts
        if (name && name !== existing.name) {
          const conflict = await prisma.project.findFirst({
            where: { name, id: { not: id } }
          });
          if (conflict) {
            reply.code(409);
            return { error: 'Project with this name already exists' };
          }
        }

        const project = await prisma.project.update({
          where: { id },
          data: { name, icon },
          include: {
            versions: true
          }
        });

        return { success: true, data: project };
      });

      fastify.delete('/projects/:id', async (request, reply) => {
        const { id } = request.params as any;

        const project = await prisma.project.findUnique({ where: { id } });
        if (!project) {
          reply.code(404);
          return { error: 'Project not found' };
        }

        await prisma.project.delete({ where: { id } });

        return { success: true, message: 'Project deleted successfully' };
      });

      // Versions
      fastify.post('/projects/:projectId/versions', async (request, reply) => {
        const { projectId } = request.params as any;
        const { name, status } = request.body as any;

        // Check if project exists
        const project = await prisma.project.findUnique({ where: { id: projectId } });
        if (!project) {
          reply.code(404);
          return { error: 'Project not found' };
        }

        const version = await prisma.version.create({
          data: {
            projectId,
            name,
            status: status || 'DRAFT',
          }
        });

        return { success: true, data: version };
      });

      // Scripts
      fastify.get('/projects/:projectId/scripts', async (request, reply) => {
        const { projectId } = request.params as any;

        // Include versions to get modules/scripts
        const project = await prisma.project.findUnique({
          where: { id: projectId },
          include: {
            versions: {
              include: {
                modules: {
                  include: {
                    scripts: true
                  }
                }
              }
            }
          }
        });

        if (!project) {
          reply.code(404);
          return { error: 'Project not found' };
        }

        // Flatten all scripts from all versions
        const scripts = project.versions.flatMap(v =>
          v.modules.flatMap(m => m.scripts.map(s => ({
            ...s,
            versionName: v.name,
            versionId: v.id,
            moduleName: m.name,
            moduleId: m.id,
          })))
        );

        return { success: true, data: scripts };
      });

      // Executions
      fastify.post('/executions', async (request, reply) => {
        const { scriptId, environment, nodeId } = request.body as any;

        // Mock execution start
        const execution = await prisma.execution.create({
          data: {
            scriptId,
            status: 'PENDING',
            environment: environment || 'default',
            triggeredBy: 'user',
            nodeId,
          }
        });

        // Simulate execution
        setTimeout(async () => {
          await prisma.execution.update({
            where: { id: execution.id },
            data: {
              status: Math.random() > 0.2 ? 'PASS' : 'FAIL',
              startedAt: new Date(),
              completedAt: new Date(),
            }
          });
        }, 5000);

        return { success: true, data: execution };
      });

      fastify.get('/executions', async (request, reply) => {
        const { status, scriptId } = request.query as any;

        const where: any = {};
        if (status) where.status = status;
        if (scriptId) where.scriptId = scriptId;

        const executions = await prisma.execution.findMany({
          where,
          include: {
            script: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        });

        return { success: true, data: executions };
      });

      // Nodes
      fastify.get('/nodes', async (request, reply) => {
        // Mock node data
        const nodes = [
          {
            id: 'node-1',
            name: 'Chrome-Mac-1',
            status: 'online',
            capabilities: ['chrome', 'firefox'],
            lastHeartbeat: new Date(),
            currentExecutionId: null,
          },
          {
            id: 'node-2',
            name: 'Firefox-Linux-1',
            status: 'online',
            capabilities: ['firefox', 'chrome'],
            lastHeartbeat: new Date(),
            currentExecutionId: null,
          },
        ];

        return { success: true, data: nodes };
      });

      // WebSocket for real-time updates
      app.get('/ws', { websocket: true }, (connection, req) => {
        wsService.addConnection(connection);
      });
    }, { prefix: '/api/v1' });
  });

  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port, host });
    console.log(`🚀 Server running on http://${host}:${port}`);
    console.log(`📚 API Documentation: http://${host}:${port}/api/v1`);
    console.log(`🔑 Test credentials: admin/admin`);

    // Test database connection
    try {
      await prisma.$connect();
      console.log('✅ Database connected');
    } catch (err) {
      console.error('❌ Database connection failed:', err);
    }

    // Test Redis connection
    try {
      const redis = redisClient.getClient();
      if (redis) {
        await redis.ping();
        console.log('✅ Redis connected');
      }
    } catch (err) {
      console.error('❌ Redis connection failed:', err);
    }

  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down gracefully...');
  process.exit(0);
});

start().catch(console.error);