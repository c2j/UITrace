import { FastifyRequest, FastifyReply } from 'fastify';
import { ProjectService } from './service';
import { createProjectSchema, updateProjectSchema, projectParamsSchema, paginationSchema } from '@/utils/validation';
import { logger } from '@/utils/logger';

export class ProjectController {
  private projectService: ProjectService;

  constructor(prisma: any) {
    this.projectService = new ProjectService(prisma);
  }

  async createProject(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = createProjectSchema.parse(request.body);
      const project = await this.projectService.createProject(data);

      reply.code(201).send({
        success: true,
        data: project,
        message: 'Project created successfully',
      });
    } catch (error: any) {
      logger.error('Error creating project', { error: error.message, body: request.body });
      reply.send(error);
    }
  }

  async getProject(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = projectParamsSchema.parse(request.params);
      const project = await this.projectService.getProject(params.projectId);

      reply.send({
        success: true,
        data: project,
      });
    } catch (error: any) {
      logger.error('Error getting project', { error: error.message, params: request.params });
      reply.send(error);
    }
  }

  async getProjectWithVersions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = projectParamsSchema.parse(request.params);
      const project = await this.projectService.getProjectWithVersions(params.projectId);

      reply.send({
        success: true,
        data: project,
      });
    } catch (error: any) {
      logger.error('Error getting project with versions', { error: error.message, params: request.params });
      reply.send(error);
    }
  }

  async listProjects(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = paginationSchema.parse(request.query);
      const result = await this.projectService.listProjects(query.page, query.limit);

      reply.send({
        success: true,
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    } catch (error: any) {
      logger.error('Error listing projects', { error: error.message, query: request.query });
      reply.send(error);
    }
  }

  async listProjectsWithVersionCount(request: FastifyRequest, reply: FastifyReply) {
    try {
      const projects = await this.projectService.listProjectsWithVersionCount();

      reply.send({
        success: true,
        data: projects,
      });
    } catch (error: any) {
      logger.error('Error listing projects with version count', { error: error.message });
      reply.send(error);
    }
  }

  async updateProject(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = projectParamsSchema.parse(request.params);
      const data = updateProjectSchema.parse(request.body);
      const project = await this.projectService.updateProject(params.projectId, data);

      reply.send({
        success: true,
        data: project,
        message: 'Project updated successfully',
      });
    } catch (error: any) {
      logger.error('Error updating project', {
        error: error.message,
        params: request.params,
        body: request.body
      });
      reply.send(error);
    }
  }

  async deleteProject(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = projectParamsSchema.parse(request.params);
      await this.projectService.deleteProject(params.projectId);

      reply.send({
        success: true,
        message: 'Project deleted successfully',
      });
    } catch (error: any) {
      logger.error('Error deleting project', { error: error.message, params: request.params });
      reply.send(error);
    }
  }

  async searchProjects(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as { q?: string; page?: string; limit?: string };
      if (!query.q) {
        reply.code(400).send({
          success: false,
          error: 'Search query is required',
        });
        return;
      }

      const page = parseInt(query.page || '1');
      const limit = parseInt(query.limit || '10');

      const result = await this.projectService.searchProjects(query.q, page, limit);

      reply.send({
        success: true,
        data: result.data,
        pagination: {
          page: result.page,
          limit: result.limit,
          total: result.total,
          totalPages: result.totalPages,
        },
      });
    } catch (error: any) {
      logger.error('Error searching projects', { error: error.message, query: request.query });
      reply.send(error);
    }
  }

  async getProjectStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = projectParamsSchema.parse(request.params);
      const stats = await this.projectService.getProjectStats(params.projectId);

      reply.send({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Error getting project stats', { error: error.message, params: request.params });
      reply.send(error);
    }
  }

  async archiveProject(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = projectParamsSchema.parse(request.params);
      const result = await this.projectService.archiveProject(params.projectId);

      reply.send({
        success: true,
        ...result,
      });
    } catch (error: any) {
      logger.error('Error archiving project', { error: error.message, params: request.params });
      reply.send(error);
    }
  }
}