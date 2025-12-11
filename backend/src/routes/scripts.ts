import { FastifyInstance } from 'fastify';
import { ScriptController } from '@/modules/script/controller';

export async function scriptRoutes(fastify: FastifyInstance) {
  const scriptController = new ScriptController(fastify.prisma);

  // Script CRUD operations
  fastify.post('/modules/:moduleId/scripts', {
    schema: {
      tags: ['Scripts'],
      summary: 'Create a new script',
      params: {
        type: 'object',
        required: ['moduleId'],
        properties: {
          moduleId: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['name', 'steps'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', maxLength: 1000 },
          priority: { type: 'string', enum: ['P0', 'P1', 'P2'], default: 'P1' },
          steps: {
            type: 'array',
            items: { $ref: '#/components/schemas/ScriptStep' },
            minItems: 1,
          },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { $ref: '#/components/schemas/Script' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, scriptController.createScript);

  fastify.get('/modules/:moduleId/scripts', {
    schema: {
      tags: ['Scripts'],
      summary: 'List scripts in a module',
      params: {
        type: 'object',
        required: ['moduleId'],
        properties: {
          moduleId: { type: 'string', format: 'uuid' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          priority: { type: 'string', enum: ['P0', 'P1', 'P2'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/Script' },
            },
          },
        },
      },
    },
  }, scriptController.listScripts);

  fastify.get('/scripts/:scriptId', {
    schema: {
      tags: ['Scripts'],
      summary: 'Get script details',
      params: {
        type: 'object',
        required: ['scriptId'],
        properties: {
          scriptId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { $ref: '#/components/schemas/Script' },
          },
        },
      },
    },
  }, scriptController.getScript);

  fastify.get('/scripts/:scriptId/executions', {
    schema: {
      tags: ['Scripts'],
      summary: 'Get script with executions',
      params: {
        type: 'object',
        required: ['scriptId'],
        properties: {
          scriptId: { type: 'string', format: 'uuid' },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
        },
      },
    },
  }, scriptController.getScriptWithExecutions);

  fastify.get('/scripts/:scriptId/stats', {
    schema: {
      tags: ['Scripts'],
      summary: 'Get script statistics',
      params: {
        type: 'object',
        required: ['scriptId'],
        properties: {
          scriptId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                totalExecutions: { type: 'number' },
                passCount: { type: 'number' },
                failCount: { type: 'number' },
                successRate: { type: 'number' },
                lastExecution: { type: 'object' },
              },
            },
          },
        },
      },
    },
  }, scriptController.getScriptStats);

  fastify.put('/scripts/:scriptId', {
    schema: {
      tags: ['Scripts'],
      summary: 'Update script',
      params: {
        type: 'object',
        required: ['scriptId'],
        properties: {
          scriptId: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 200 },
          description: { type: 'string', maxLength: 1000 },
          priority: { type: 'string', enum: ['P0', 'P1', 'P2'] },
          steps: {
            type: 'array',
            items: { $ref: '#/components/schemas/ScriptStep' },
            minItems: 1,
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { $ref: '#/components/schemas/Script' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, scriptController.updateScript);

  fastify.delete('/scripts/:scriptId', {
    schema: {
      tags: ['Scripts'],
      summary: 'Delete script',
      params: {
        type: 'object',
        required: ['scriptId'],
        properties: {
          scriptId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, scriptController.deleteScript);

  // Script search and filtering
  fastify.get('/projects/:projectId/scripts/search', {
    schema: {
      tags: ['Scripts'],
      summary: 'Search scripts in a project',
      params: {
        type: 'object',
        required: ['projectId'],
        properties: {
          projectId: { type: 'string', format: 'uuid' },
        },
      },
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 2 },
        },
      },
    },
  }, scriptController.searchScripts);

  fastify.get('/scripts/status/:status', {
    schema: {
      tags: ['Scripts'],
      summary: 'Get scripts by status',
      params: {
        type: 'object',
        required: ['status'],
        properties: {
          status: { type: 'string', enum: ['PASS', 'FAIL', 'SKIP', 'PENDING'] },
        },
      },
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
        },
      },
    },
  }, scriptController.getScriptsByStatus);

  fastify.get('/scripts/priority', {
    schema: {
      tags: ['Scripts'],
      summary: 'Get scripts by priority range',
      querystring: {
        type: 'object',
        required: ['minPriority', 'maxPriority'],
        properties: {
          minPriority: { type: 'string', enum: ['P0', 'P1', 'P2'] },
          maxPriority: { type: 'string', enum: ['P0', 'P1', 'P2'] },
        },
      },
    },
  }, scriptController.getScriptsByPriority);

  fastify.get('/scripts/environment/:environment', {
    schema: {
      tags: ['Scripts'],
      summary: 'Get scripts by environment',
      params: {
        type: 'object',
        required: ['environment'],
        properties: {
          environment: { type: 'string', minLength: 1 },
        },
      },
    },
  }, scriptController.getScriptsByEnvironment);

  // Script operations
  fastify.post('/scripts/:scriptId/duplicate', {
    schema: {
      tags: ['Scripts'],
      summary: 'Duplicate script',
      params: {
        type: 'object',
        required: ['scriptId'],
        properties: {
          scriptId: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['targetModuleId', 'newName'],
        properties: {
          targetModuleId: { type: 'string', format: 'uuid' },
          newName: { type: 'string', minLength: 1 },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { $ref: '#/components/schemas/Script' },
            message: { type: 'string' },
          },
        },
      },
    },
  }, scriptController.duplicateScript);

  fastify.post('/scripts/validate', {
    schema: {
      tags: ['Scripts'],
      summary: 'Validate script steps',
      body: {
        type: 'object',
        required: ['steps'],
        properties: {
          steps: {
            type: 'array',
            items: { $ref: '#/components/schemas/ScriptStep' },
            minItems: 1,
          },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                valid: { type: 'boolean' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, scriptController.validateScript);

  // Script execution (placeholder for User Story 2)
  fastify.post('/scripts/:scriptId/run', {
    schema: {
      tags: ['Scripts'],
      summary: 'Execute a script',
      params: {
        type: 'object',
        required: ['scriptId'],
        properties: {
          scriptId: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['environment', 'triggeredBy'],
        properties: {
          environment: { type: 'string', minLength: 1, maxLength: 100 },
          triggeredBy: { type: 'string', minLength: 1, maxLength: 100 },
          nodeId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, scriptController.runScript);
}