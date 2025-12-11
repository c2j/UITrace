import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import { config } from './config/index.js';

async function start() {
  const app = fastify({
    logger: {
      level: config.logging.level,
    },
  });

  // Register plugins
  await app.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (mobile apps, etc)
      if (!origin) return cb(null, true);
      const allowedOrigins = ['http://localhost:3000', 'http://localhost:3002'];
      if (allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  });

  await app.register(helmet);

  await app.register(jwt, {
    secret: config.jwt.secret,
  });

  // Mock auth routes
  const users: any[] = [];

  app.post('/api/v1/auth/register', async (request, reply) => {
    const { email, password, name } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({
        error: 'Email and password are required',
      });
    }

    const existingUser = users.find(u => u.email === email);
    if (existingUser) {
      return reply.status(409).send({
        error: 'User already exists',
      });
    }

    const user = {
      id: Date.now().toString(),
      email,
      name: name || null,
      role: 'USER',
      createdAt: new Date().toISOString(),
    };

    users.push(user);

    const token = app.jwt.sign({ sub: user.id, email: user.email, role: user.role });

    return reply.send({
      success: true,
      data: {
        user,
        token,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      },
    });
  });

  app.post('/api/v1/auth/login', async (request, reply) => {
    const { email, password } = request.body as any;

    if (!email || !password) {
      return reply.status(400).send({
        error: 'Email and password are required',
      });
    }

    const user = users.find(u => u.email === email);
    if (!user) {
      return reply.status(401).send({
        error: 'Invalid credentials',
      });
    }

    const token = app.jwt.sign({ sub: user.id, email: user.email, role: user.role });

    return reply.send({
      success: true,
      data: {
        user,
        token,
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      },
    });
  });

  app.post('/api/v1/auth/logout', async (request, reply) => {
    return reply.send({
      success: true,
      message: 'Logged out successfully',
    });
  });

  app.get('/api/v1/auth/me', async (request: any, reply) => {
    try {
      await request.jwtVerify();
      return reply.send({
        success: true,
        data: request.user,
      });
    } catch (error) {
      return reply.status(401).send({
        error: 'Unauthorized',
      });
    }
  });

  // Mock API routes for frontend
  app.get('/api/v1/projects', async () => {
    return {
      success: true,
      data: [],
      message: 'No projects found'
    };
  });

  app.get('/api/v1/scripts', async () => {
    return {
      success: true,
      data: [],
      message: 'No scripts found'
    };
  });

  app.get('/api/v1/executions', async () => {
    return {
      success: true,
      data: [],
      message: 'No executions found'
    };
  });

  // Mock POST routes for creating projects
  app.post('/api/v1/projects', async (request, reply) => {
    const { name, icon } = request.body as any;
    const newProject = {
      id: Date.now().toString(),
      name,
      icon: icon || 'folder',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return reply.send({
      success: true,
      data: newProject,
      message: 'Project created successfully'
    });
  });

  app.post('/api/v1/scripts', async (request, reply) => {
    const { name, projectId } = request.body as any;
    const newScript = {
      id: Date.now().toString(),
      name,
      projectId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return reply.send({
      success: true,
      data: newScript,
      message: 'Script created successfully'
    });
  });

  app.post('/api/v1/executions', async (request, reply) => {
    const { scriptId } = request.body as any;
    const newExecution = {
      id: Date.now().toString(),
      scriptId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return reply.send({
      success: true,
      data: newExecution,
      message: 'Execution started successfully'
    });
  });

  // Health check
  app.get('/health', async () => {
    return { status: 'ok' };
  });

  try {
    await app.listen({
      port: config.app.port,
      host: config.app.host,
    });

    console.log(`🚀 Server running on http://${config.app.host}:${config.app.port}`);
    console.log(`🔐 Auth endpoints: http://${config.app.host}:${config.app.port}/api/v1/auth`);
    console.log(`💚 Health check: http://${config.app.host}:${config.app.port}/health`);
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

start();
