import { FastifyInstance } from 'fastify';
import { NodeController } from '../modules/node/controller';
import { schemas } from '../utils/validation';

export async function nodeRoutes(fastify: FastifyInstance, options: { controller: NodeController }) {
  const { controller } = options;

  // Register node
  fastify.post('/nodes', {
    schema: {
      description: 'Register a new node or update existing node',
      tags: ['Nodes'],
      body: {
        type: 'object',
        required: ['name', 'ip', 'os', 'browsers'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
          ip: { type: 'string', format: 'ipv4' },
          os: { type: 'string', minLength: 1, maxLength: 50 },
          browsers: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['name'],
              properties: {
                name: {
                  type: 'string',
                  enum: ['chrome', 'firefox', 'safari', 'edge']
                },
                version: { type: 'string' },
                platform: {
                  type: 'string',
                  enum: ['windows', 'macos', 'linux']
                },
              },
            },
          },
          hardwareStats: {
            type: 'object',
            properties: {
              cpu: { type: 'number', minimum: 0, maximum: 100 },
              memory: { type: 'number', minimum: 0, maximum: 100 },
              disk: { type: 'number', minimum: 0, maximum: 100 },
            },
            required: ['cpu', 'memory', 'disk'],
          },
        },
      },
      response: {
        201: {
          description: 'Node registered successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { $ref: '#/components/schemas/Node' },
          },
        },
        400: { $ref: '#/components/responses/BadRequest' },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  }, controller.registerNode.bind(controller));

  // Send heartbeat
  fastify.post('/nodes/:nodeId/heartbeat', {
    schema: {
      description: 'Send heartbeat to keep node alive',
      tags: ['Nodes'],
      params: {
        type: 'object',
        required: ['nodeId'],
        properties: {
          nodeId: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        properties: {
          hardwareStats: {
            type: 'object',
            properties: {
              cpu: { type: 'number', minimum: 0, maximum: 100 },
              memory: { type: 'number', minimum: 0, maximum: 100 },
              disk: { type: 'number', minimum: 0, maximum: 100 },
            },
            required: ['cpu', 'memory', 'disk'],
          },
        },
      },
      response: {
        200: {
          description: 'Heartbeat received',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
        400: { $ref: '#/components/responses/BadRequest' },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  }, controller.heartbeat.bind(controller));

  // Get all nodes
  fastify.get('/nodes', {
    schema: {
      description: 'Get all nodes with optional filtering',
      tags: ['Nodes'],
      querystring: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['ONLINE', 'OFFLINE', 'BUSY', 'MAINTENANCE']
          },
          page: { type: 'string', pattern: '^[1-9]\\d*$' },
          limit: { type: 'string', pattern: '^[1-9]\\d*$' },
        },
      },
      response: {
        200: {
          description: 'List of nodes',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: { $ref: '#/components/schemas/Node' },
            },
            pagination: { $ref: '#/components/schemas/Pagination' },
          },
        },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  }, controller.getNodes.bind(controller));

  // Get node by ID
  fastify.get('/nodes/:nodeId', {
    schema: {
      description: 'Get node by ID',
      tags: ['Nodes'],
      params: {
        type: 'object',
        required: ['nodeId'],
        properties: {
          nodeId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          description: 'Node details',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { $ref: '#/components/schemas/Node' },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
        500: {ref: '#/components/responses/InternalError' },
      },
    },
  }, controller.getNode.bind(controller));

  // Find best node for execution
  fastify.post('/nodes/find-best', {
    schema: {
      description: 'Find best node for execution based on capabilities',
      tags: ['Nodes'],
      body: {
        type: 'object',
        required: ['capabilities'],
        properties: {
          capabilities: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['browser'],
              properties: {
                browser: {
                  type: 'string',
                  enum: ['chrome', 'firefox', 'safari', 'edge']
                },
                version: { type: 'string' },
                platform: {
                  type: 'string',
                  enum: ['windows', 'macos', 'linux']
                },
              },
            },
          },
          excludeNodes: {
            type: 'array',
            items: { type: 'string', format: 'uuid' },
          },
        },
      },
      response: {
        200: {
          description: 'Best node found',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { $ref: '#/components/schemas/Node' },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
        400: { $ref: '#/components/responses/BadRequest' },
        500: {ref: '#/components/responses/InternalError' },
      },
    },
  }, controller.findBestNode.bind(controller));

  // Update node capabilities
  fastify.put('/nodes/:nodeId/capabilities', {
    schema: {
      description: 'Update node capabilities',
      tags: ['Nodes'],
      params: {
        type: 'object',
        required: ['nodeId'],
        properties: {
          nodeId: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        required: ['browsers'],
        properties: {
          browsers: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['name'],
              properties: {
                name: {
                  type: 'string',
                  enum: ['chrome', 'firefox', 'safari', 'edge']
                },
                version: { type: 'string' },
                platform: {
                  type: 'string',
                  enum: ['windows', 'macos', 'linux']
                },
              },
            },
          },
        },
      },
      response: {
        200: {
          description: 'Node capabilities updated',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { $ref: '#/components/schemas/Node' },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
        400: { $ref: '#/components/responses/BadRequest' },
        500: { ref: '#/components/responses/InternalError' },
      },
    },
  }, controller.updateNodeCapabilities.bind(controller));

  // Set node to maintenance mode
  fastify.post('/nodes/:nodeId/maintenance', {
    schema: {
      description: 'Set node to maintenance mode',
      tags: ['Nodes'],
      params: {
        type: 'object',
        required: ['nodeId'],
        properties: {
          nodeId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          description: 'Node set to maintenance mode',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
        500: { ref: '#/components/responses/InternalError' },
      },
    },
  }, controller.setMaintenanceMode.bind(controller));

  // Delete node
  fastify.delete('/nodes/:nodeId', {
    schema: {
      description: 'Delete node',
      tags: ['Nodes'],
      params: {
        type: 'object',
        required: ['nodeId'],
        properties: {
          nodeId: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          description: 'Node deleted successfully',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
        404: { $ref: '#/components/responses/NotFound' },
        409: {
          description: 'Node cannot be deleted',
          type: 'object',
          properties: {
            error: { type: 'string' },
          },
        },
        500: { ref: '#/components/responses/InternalError' },
      },
    },
  }, controller.deleteNode.bind(controller));

  // Get node statistics
  fastify.get('/nodes/stats', {
    schema: {
      description: 'Get node statistics',
      tags: ['Nodes'],
      response: {
        200: {
          description: 'Node statistics',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                total: { type: 'integer' },
                online: { type: 'integer' },
                offline: { type: 'integer' },
                busy: { type: 'integer' },
                maintenance: { type: 'integer' },
              },
              required: ['total', 'online', 'offline', 'busy', 'maintenance'],
            },
          },
        },
        500: { ref: '#/components/responses/InternalError' },
      },
    },
  }, controller.getNodeStats.bind(controller));

  // Get heartbeat monitor status
  fastify.get('/nodes/heartbeat-status', {
    schema: {
      description: 'Get heartbeat monitor status',
      tags: ['Nodes'],
      response: {
        200: {
          description: 'Heartbeat monitor status',
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                running: { type: 'boolean' },
                lastCheck: { type: 'string', format: 'date-time' },
                nextCheck: { type: 'string', format: 'date-time' },
                stats: {
                  type: 'object',
                  properties: {
                    totalNodes: { type: 'integer' },
                    onlineNodes: { type: 'integer' },
                    offlineNodes: { type: 'integer' },
                    staleNodes: { type: 'integer' },
                  },
                  required: ['totalNodes', 'onlineNodes', 'offlineNodes', 'staleNodes'],
                },
              },
              required: ['running', 'stats'],
            },
          },
        },
        500: { ref: '#/components/responses/InternalError' },
      },
    },
  }, controller.getHeartbeatStatus.bind(controller));
}