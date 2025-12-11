import { createApp } from './app';
import { config } from './config';

async function start() {
  try {
    const app = await createApp();

    await app.listen({
      port: config.app.port,
      host: config.app.host,
    });

    console.log(`🚀 Server running on http://${config.app.host}:${config.app.port}`);
    console.log(`📚 API Documentation: http://${config.app.host}:${config.app.port}/docs`);
  } catch (error) {
    console.error('Error starting server:', error);
    process.exit(1);
  }
}

// Start server
start();