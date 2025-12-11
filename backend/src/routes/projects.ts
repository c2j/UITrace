import { FastifyInstance } from 'fastify';
import { ProjectController } from '@/modules/project/controller';

export async function projectRoutes(fastify: FastifyInstance) {
  const projectController = new ProjectController(fastify.prisma);

  // Bind all methods to preserve 'this' context
  const boundController = {
    createProject: projectController.createProject.bind(projectController),
    getProject: projectController.getProject.bind(projectController),
    getProjectWithVersions: projectController.getProjectWithVersions.bind(projectController),
    listProjects: projectController.listProjects.bind(projectController),
    listProjectsWithVersionCount: projectController.listProjectsWithVersionCount.bind(projectController),
    updateProject: projectController.updateProject.bind(projectController),
    deleteProject: projectController.deleteProject.bind(projectController),
    searchProjects: projectController.searchProjects.bind(projectController),
    getProjectStats: projectController.getProjectStats.bind(projectController),
    archiveProject: projectController.archiveProject.bind(projectController),
  };

  // Project CRUD operations
  fastify.post('/projects', {
    schema: {
      tags: ['Projects'],
      summary: 'Create a new project',
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100 },
          icon: { type: 'string', maxLength: 50 },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                id: { type: 'string' },
                name: { type: 'string' },
                icon: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
            message: { type: 'string' },
          },
        },
      },
    },
  }, boundController.createProject);

  fastify.get('/projects', {
    schema: {
      tags: ['Projects'],
      summary: 'List all projects',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  icon: { type: 'string' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                },
              },
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                totalPages: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, boundController.listProjects);

  fastify.get('/projects/summary', {
    schema: {
      tags: ['Projects'],
      summary: 'List projects with version count',
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  icon: { type: 'string' },
                  createdAt: { type: 'string' },
                  updatedAt: { type: 'string' },
                  _count: {
                    type: 'object',
                    properties: {
                      versions: { type: 'number' },
                    },
                  },
                  versions: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        name: { type: 'string' },
                        status: { type: 'string' },
                        _count: {
                          type: 'object',
                          properties: {
                            modules: { type: 'number' },
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
      },
    },
  }, boundController.listProjectsWithVersionCount);

  fastify.get('/projects/search', {
    schema: {
      tags: ['Projects'],
      summary: 'Search projects',
      querystring: {
        type: 'object',
        required: ['q'],
        properties: {
          q: { type: 'string', minLength: 2 },
          page: { type: 'number', minimum: 1, default: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 10 },
        },
      },
    },
  }, boundController.searchProjects);

  fastify.get('/projects/:projectId', {
    schema: {
      tags: ['Projects'],
      summary: 'Get project details',
      params: {
        type: 'object',
        required: ['projectId'],
        properties: {
          projectId: { type: 'string', format: 'uuid' },
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
                id: { type: 'string' },
                name: { type: 'string' },
                icon: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
          },
        },
      },
    },
  }, boundController.getProject);

  fastify.get('/projects/:projectId/versions', {
    schema: {
      tags: ['Projects'],
      summary: 'Get project with versions',
      params: {
        type: 'object',
        required: ['projectId'],
        properties: {
          projectId: { type: 'string', format: 'uuid' },
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
                id: { type: 'string' },
                name: { type: 'string' },
                icon: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
                versions: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      id: { type: 'string' },
                      name: { type: 'string' },
                      status: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, boundController.getProjectWithVersions);

  fastify.get('/projects/:projectId/stats', {
    schema: {
      tags: ['Projects'],
      summary: 'Get project statistics',
      params: {
        type: 'object',
        required: ['projectId'],
        properties: {
          projectId: { type: 'string', format: 'uuid' },
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
                project: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    icon: { type: 'string' },
                    createdAt: { type: 'string' },
                    updatedAt: { type: 'string' },
                  },
                },
                versions: {
                  type: 'object',
                  properties: {
                    total: { type: 'number' },
                    active: { type: 'number' },
                    archived: { type: 'number' },
                    draft: { type: 'number' },
                  },
                },
                modules: { type: 'number' },
                scripts: { type: 'number' },
                executions: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, boundController.getProjectStats);

  fastify.put('/projects/:projectId', {
    schema: {
      tags: ['Projects'],
      summary: 'Update project',
      params: {
        type: 'object',
        required: ['projectId'],
        properties: {
          projectId: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 2, maxLength: 100 },
          icon: { type: 'string', maxLength: 50 },
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
                id: { type: 'string' },
                name: { type: 'string' },
                icon: { type: 'string' },
                createdAt: { type: 'string' },
                updatedAt: { type: 'string' },
              },
            },
            message: { type: 'string' },
          },
        },
      },
    },
  }, boundController.updateProject);

  fastify.post('/projects/:projectId/archive', {
    schema: {
      tags: ['Projects'],
      summary: 'Archive project',
      params: {
        type: 'object',
        required: ['projectId'],
        properties: {
          projectId: { type: 'string', format: 'uuid' },
        },
      },
    },
  }, boundController.archiveProject);

  fastify.delete('/projects/:projectId', {
    schema: {
      tags: ['Projects'],
      summary: 'Delete project',
      params: {
        type: 'object',
        required: ['projectId'],
        properties: {
          projectId: { type: 'string', format: 'uuid' },
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
  }, boundController.deleteProject);
}