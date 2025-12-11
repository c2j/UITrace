import { FastifyRequest, FastifyReply } from 'fastify';
import { ScriptService } from './service';
import {
  createScriptSchema,
  updateScriptSchema,
  scriptParamsSchema,
  paginationSchema,
  runScriptSchema,
} from '@/utils/validation';
import { logger } from '@/utils/logger';

export class ScriptController {
  private scriptService: ScriptService;

  constructor(prisma: any) {
    this.scriptService = new ScriptService(prisma);
  }

  async createScript(request: FastifyRequest, reply: FastifyReply) {
    try {
      const data = createScriptSchema.parse(request.body);
      const script = await this.scriptService.createScript(data);

      reply.code(201).send({
        success: true,
        data: script,
        message: 'Script created successfully',
      });
    } catch (error: any) {
      logger.error('Error creating script', { error: error.message, body: request.body });
      reply.send(error);
    }
  }

  async getScript(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = scriptParamsSchema.parse(request.params);
      const script = await this.scriptService.getScript(params.scriptId);

      reply.send({
        success: true,
        data: script,
      });
    } catch (error: any) {
      logger.error('Error getting script', { error: error.message, params: request.params });
      reply.send(error);
    }
  }

  async getScriptWithExecutions(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = scriptParamsSchema.parse(request.params);
      const query = request.query as { limit?: string };
      const limit = parseInt(query.limit || '10');

      const script = await this.scriptService.getScriptWithExecutions(params.scriptId, limit);

      reply.send({
        success: true,
        data: script,
      });
    } catch (error: any) {
      logger.error('Error getting script with executions', {
        error: error.message,
        params: request.params,
        query: request.query
      });
      reply.send(error);
    }
  }

  async listScripts(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as { moduleId: string };
      const query = request.query as { priority?: string };

      const scripts = await this.scriptService.listScripts(params.moduleId, query.priority);

      reply.send({
        success: true,
        data: scripts,
      });
    } catch (error: any) {
      logger.error('Error listing scripts', {
        error: error.message,
        params: request.params,
        query: request.query
      });
      reply.send(error);
    }
  }

  async updateScript(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = scriptParamsSchema.parse(request.params);
      const data = updateScriptSchema.parse(request.body);
      const script = await this.scriptService.updateScript(params.scriptId, data);

      reply.send({
        success: true,
        data: script,
        message: 'Script updated successfully',
      });
    } catch (error: any) {
      logger.error('Error updating script', {
        error: error.message,
        params: request.params,
        body: request.body
      });
      reply.send(error);
    }
  }

  async deleteScript(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = scriptParamsSchema.parse(request.params);
      await this.scriptService.deleteScript(params.scriptId);

      reply.send({
        success: true,
        message: 'Script deleted successfully',
      });
    } catch (error: any) {
      logger.error('Error deleting script', { error: error.message, params: request.params });
      reply.send(error);
    }
  }

  async getScriptStats(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = scriptParamsSchema.parse(request.params);
      const stats = await this.scriptService.getScriptStats(params.scriptId);

      reply.send({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Error getting script stats', { error: error.message, params: request.params });
      reply.send(error);
    }
  }

  async searchScripts(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = request.params as { projectId: string };
      const query = request.query as { q?: string };

      if (!query.q) {
        reply.code(400).send({
          success: false,
          error: 'Search query is required',
        });
        return;
      }

      const scripts = await this.scriptService.searchScripts(params.projectId, query.q);

      reply.send({
        success: true,
        data: scripts,
      });
    } catch (error: any) {
      logger.error('Error searching scripts', {
        error: error.message,
        params: request.params,
        query: request.query
      });
      reply.send(error);
    }
  }

  async getScriptsByStatus(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as {
        status?: string;
        page?: string;
        limit?: string;
      };

      if (!query.status) {
        reply.code(400).send({
          success: false,
          error: 'Status is required',
        });
        return;
      }

      const page = parseInt(query.page || '1');
      const limit = parseInt(query.limit || '10');

      const result = await this.scriptService.getScriptsByStatus(query.status, page, limit);

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
      logger.error('Error getting scripts by status', { error: error.message, query: request.query });
      reply.send(error);
    }
  }

  async getScriptsByPriority(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as { minPriority?: string; maxPriority?: string };

      if (!query.minPriority || !query.maxPriority) {
        reply.code(400).send({
          success: false,
          error: 'Both minPriority and maxPriority are required',
        });
        return;
      }

      const scripts = await this.scriptService.getScriptsByPriority(
        query.minPriority,
        query.maxPriority
      );

      reply.send({
        success: true,
        data: scripts,
      });
    } catch (error: any) {
      logger.error('Error getting scripts by priority', { error: error.message, query: request.query });
      reply.send(error);
    }
  }

  async duplicateScript(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = scriptParamsSchema.parse(request.params);
      const body = request.body as { targetModuleId: string; newName: string };

      if (!body.targetModuleId || !body.newName) {
        reply.code(400).send({
          success: false,
          error: 'targetModuleId and newName are required',
        });
        return;
      }

      const newScript = await this.scriptService.duplicateScript(
        params.scriptId,
        body.targetModuleId,
        body.newName
      );

      reply.code(201).send({
        success: true,
        data: newScript,
        message: 'Script duplicated successfully',
      });
    } catch (error: any) {
      logger.error('Error duplicating script', {
        error: error.message,
        params: request.params,
        body: request.body
      });
      reply.send(error);
    }
  }

  async getScriptsByEnvironment(request: FastifyRequest, reply: FastifyReply) {
    try {
      const query = request.query as { environment?: string };

      if (!query.environment) {
        reply.code(400).send({
          success: false,
          error: 'Environment is required',
        });
        return;
      }

      const scripts = await this.scriptService.getScriptsByEnvironment(query.environment);

      reply.send({
        success: true,
        data: scripts,
      });
    } catch (error: any) {
      logger.error('Error getting scripts by environment', { error: error.message, query: request.query });
      reply.send(error);
    }
  }

  async validateScript(request: FastifyRequest, reply: FastifyReply) {
    try {
      const body = request.body as { steps: any[] };

      if (!body.steps || !Array.isArray(body.steps)) {
        reply.code(400).send({
          success: false,
          error: 'Steps array is required',
        });
        return;
      }

      const result = await this.scriptService.validateScriptSteps(body.steps);

      reply.send({
        success: true,
        data: result,
      });
    } catch (error: any) {
      logger.error('Error validating script steps', { error: error.message, body: request.body });
      reply.send(error);
    }
  }

  async runScript(request: FastifyRequest, reply: FastifyReply) {
    try {
      const params = scriptParamsSchema.parse(request.params);
      const data = runScriptSchema.parse(request.body);

      // This is a placeholder for script execution
      // The actual implementation will be in User Story 2
      reply.code(501).send({
        success: false,
        error: 'Script execution not yet implemented',
        message: 'This feature will be available in User Story 2',
      });
    } catch (error: any) {
      logger.error('Error running script', {
        error: error.message,
        params: request.params,
        body: request.body
      });
      reply.send(error);
    }
  }
}