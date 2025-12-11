import { FastifyInstance } from 'fastify';
import { projectRoutes } from './projects';
import { scriptRoutes } from './scripts';
import { executionRoutes } from '@/modules/execution/routes';
import authRoutes from './auth';

export const routes = async (fastify: FastifyInstance) => {
  // Root endpoint
  fastify.get('/', async () => {
    return {
      message: 'UITrace Backend API',
      version: '1.0.0',
      docs: '/docs',
    };
  });

  // Register route modules
  await fastify.register(authRoutes, { prefix: '/auth' });
  await fastify.register(projectRoutes);
  await fastify.register(scriptRoutes);
  await fastify.register(executionRoutes, { prefix: '/executions' });
};