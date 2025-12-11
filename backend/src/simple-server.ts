// Simple server to test basic setup
import fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

const createApp = async () => {
  const app = fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
        }
      }
    },
  });

  // Register plugins
  await app.register(cors, {
    origin: true,
  });

  await app.register(helmet);

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Basic API route
  app.get('/api/v1/health', async () => {
    return {
      status: 'ok',
      message: 'UITrace Backend is running',
      timestamp: new Date().toISOString()
    };
  });

  // Projects endpoint (mock for now)
  app.get('/api/v1/projects', async () => {
    return {
      success: true,
      data: [
        {
          id: '1',
          name: 'Demo Project',
          icon: 'rocket',
          versions: [
            {
              id: '1-1',
              name: 'v1.0.0',
              status: 'ACTIVE',
              stats: {
                passRate: 95,
                coverage: 85,
                totalScripts: 42
              }
            }
          ]
        }
      ]
    };
  });

  return app;
};

const start = async () => {
  try {
    const app = await createApp();

    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';

    await app.listen({ port: Number(port), host });

    app.log.info(`Server listening on http://${host}:${port}`);
    app.log.info(`Health check: http://${host}:${port}/health`);
    app.log.info(`API endpoint: http://${host}:${port}/api/v1`);

  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
};

// Start server
start();