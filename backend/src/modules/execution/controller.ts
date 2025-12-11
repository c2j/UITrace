import { FastifyRequest, FastifyReply } from 'fastify';
import { ExecutionService } from './service';
import { VisualDiffService } from './visual-diff-service';
import { WebSocketService } from '@/libs/websocket';
import { QueueService } from '@/libs/queue';
import { logger } from '@/utils/logger';
import {
  CreateExecutionSchema,
  GetExecutionSchema,
  UpdateExecutionSchema,
  GetExecutionsSchema,
  GetExecutionLogsSchema,
  StopExecutionSchema,
  RetryExecutionSchema
} from './schemas';

export class ExecutionController {
  private executionService: ExecutionService;
  private visualDiffService: VisualDiffService;

  constructor(
    executionService: ExecutionService,
    visualDiffService?: VisualDiffService
  ) {
    this.executionService = executionService;
    this.visualDiffService = visualDiffService!;
  }

  async runScript(
    request: FastifyRequest<{ Params: { scriptId: string }, Body: CreateExecutionSchema['body'] }>,
    reply: FastifyReply
  ) {
    const { scriptId } = request.params;
    const { environment, triggeredBy, nodeId } = request.body;

    try {
      const execution = await this.executionService.runScript(scriptId, {
        environment,
        triggeredBy,
        nodeId,
      });

      logger.info('Script execution started', {
        executionId: execution.id,
        scriptId,
        triggeredBy,
      });

      return reply.status(201).send({
        success: true,
        data: {
          id: execution.id,
          scriptId: execution.scriptId,
          status: execution.status,
          environment: execution.environment,
          triggeredBy: execution.triggeredBy,
          nodeId: execution.nodeId,
          createdAt: execution.startTime,
        },
      });
    } catch (error: any) {
      logger.error('Failed to start script execution', {
        scriptId,
        error: error.message,
      });

      return reply.status(400).send({
        success: false,
        error: error.message,
      });
    }
  }

  async getExecution(
    request: FastifyRequest<{ Params: { executionId: string }, Querystring: GetExecutionSchema['querystring'] }>,
    reply: FastifyReply
  ) {
    const { executionId } = request.params;
    const { include } = request.query;

    try {
      const execution = await this.executionService.getExecution(
        executionId,
        include?.split(',').filter(Boolean)
      );

      logger.debug('Retrieved execution', { executionId, include });

      return reply.send({
        success: true,
        data: execution,
      });
    } catch (error: any) {
      if (error.statusCode === 404) {
        return reply.status(404).send({
          success: false,
          error: 'Execution not found',
        });
      }

      logger.error('Failed to get execution', {
        executionId,
        error: error.message,
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve execution',
      });
    }
  }

  async getExecutions(
    request: FastifyRequest<{ Querystring: GetExecutionsSchema['querystring'] }>,
    reply: FastifyReply
  ) {
    const {
      scriptId,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = request.query;

    try {
      const filters: any = {
        scriptId,
        status,
      };

      if (startDate) {
        filters.startDate = new Date(startDate);
      }
      if (endDate) {
        filters.endDate = new Date(endDate);
      }

      const result = await this.executionService.getExecutions({
        ...filters,
        page: parseInt(page.toString()),
        limit: parseInt(limit.toString()),
      });

      logger.debug('Retrieved executions', {
        filters,
        page,
        limit,
        total: 'total' in result ? result.total : result.data.length,
      });

      return reply.send({
        success: true,
        data: result.data,
        pagination: 'pagination' in result ? result.pagination : undefined,
      });
    } catch (error: any) {
      logger.error('Failed to get executions', {
        error: error.message,
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve executions',
      });
    }
  }

  async stopExecution(
    request: FastifyRequest<{ Params: { executionId: string }, Body: StopExecutionSchema['body'] }>,
    reply: FastifyReply
  ) {
    const { executionId } = request.params;
    const { triggeredBy } = request.body;

    try {
      await this.executionService.stopExecution(executionId, triggeredBy);

      logger.info('Execution stopped', {
        executionId,
        triggeredBy,
      });

      return reply.send({
        success: true,
        message: 'Execution stopped successfully',
      });
    } catch (error: any) {
      if (error.statusCode === 404) {
        return reply.status(404).send({
          success: false,
          error: 'Execution not found',
        });
      }

      if (error.statusCode === 400) {
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }

      logger.error('Failed to stop execution', {
        executionId,
        error: error.message,
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to stop execution',
      });
    }
  }

  async updateExecution(
    request: FastifyRequest<{ Params: { executionId: string }, Body: UpdateExecutionSchema['body'] }>,
    reply: FastifyReply
  ) {
    const { executionId } = request.params;
    const updateData = request.body;

    try {
      await this.executionService.updateExecution(executionId, updateData);

      logger.info('Execution updated', {
        executionId,
        update: updateData,
      });

      return reply.send({
        success: true,
        message: 'Execution updated successfully',
      });
    } catch (error: any) {
      if (error.statusCode === 404) {
        return reply.status(404).send({
          success: false,
          error: 'Execution not found',
        });
      }

      logger.error('Failed to update execution', {
        executionId,
        error: error.message,
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to update execution',
      });
    }
  }

  async getExecutionLogs(
    request: FastifyRequest<{ Params: { executionId: string }, Querystring: GetExecutionLogsSchema['querystring'] }>,
    reply: FastifyReply
  ) {
    const { executionId } = request.params;
    const {
      page = 1,
      limit = 100,
      level,
      stepId,
    } = request.query;

    try {
      const result = await this.executionService.getExecutionLogs(
        executionId,
        parseInt(page.toString()),
        parseInt(limit.toString()),
        level,
        stepId ? parseInt(stepId.toString()) : undefined
      );

      logger.debug('Retrieved execution logs', {
        executionId,
        page,
        limit,
        level,
        stepId,
      });

      return reply.send({
        success: true,
        data: result.data,
        pagination: result.pagination,
      });
    } catch (error: any) {
      if (error.statusCode === 404) {
        return reply.status(404).send({
          success: false,
          error: 'Execution not found',
        });
      }

      logger.error('Failed to get execution logs', {
        executionId,
        error: error.message,
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve execution logs',
      });
    }
  }

  async getVisualDiffs(
    request: FastifyRequest<{ Params: { executionId: string } }>,
    reply: FastifyReply
  ) {
    const { executionId } = request.params;

    try {
      const visualDiffs = await this.executionService.getVisualDiffs(executionId);

      logger.debug('Retrieved visual diffs', {
        executionId,
        count: visualDiffs.length,
      });

      return reply.send({
        success: true,
        data: visualDiffs,
      });
    } catch (error: any) {
      logger.error('Failed to get visual diffs', {
        executionId,
        error: error.message,
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve visual diffs',
      });
    }
  }

  async getExecutionStats(
    request: FastifyRequest<{ Querystring: { scriptId?: string; startDate?: string; endDate?: string } }>,
    reply: FastifyReply
  ) {
    const { scriptId, startDate, endDate } = request.query;

    try {
      const filter: any = {};
      if (scriptId) filter.scriptId = scriptId;
      if (startDate) filter.startDate = new Date(startDate);
      if (endDate) filter.endDate = new Date(endDate);

      const stats = await this.executionService.getExecutionStats(filter);

      logger.debug('Retrieved execution stats', { filter });

      return reply.send({
        success: true,
        data: stats,
      });
    } catch (error: any) {
      logger.error('Failed to get execution stats', {
        error: error.message,
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve execution statistics',
      });
    }
  }

  async getRecentExecutions(
    request: FastifyRequest<{ Querystring: { limit?: string } }>,
    reply: FastifyReply
  ) {
    const { limit = '10' } = request.query;

    try {
      const executions = await this.executionService.getRecentExecutions(
        parseInt(limit.toString())
      );

      logger.debug('Retrieved recent executions', { limit });

      return reply.send({
        success: true,
        data: executions,
      });
    } catch (error: any) {
      logger.error('Failed to get recent executions', {
        error: error.message,
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to retrieve recent executions',
      });
    }
  }

  async retryExecution(
    request: FastifyRequest<{ Params: { executionId: string }, Body: RetryExecutionSchema['body'] }>,
    reply: FastifyReply
  ) {
    const { executionId } = request.params;
    const { triggeredBy } = request.body;

    try {
      const newExecution = await this.executionService.retryFailedExecution(
        executionId,
        triggeredBy
      );

      logger.info('Execution retried', {
        originalExecutionId: executionId,
        newExecutionId: newExecution.id,
        triggeredBy,
      });

      return reply.status(201).send({
        success: true,
        data: {
          id: newExecution.id,
          scriptId: newExecution.scriptId,
          status: newExecution.status,
          triggeredBy: newExecution.triggeredBy,
          createdAt: newExecution.startTime,
        },
      });
    } catch (error: any) {
      if (error.statusCode === 404) {
        return reply.status(404).send({
          success: false,
          error: 'Execution not found',
        });
      }

      if (error.statusCode === 400) {
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }

      logger.error('Failed to retry execution', {
        executionId,
        error: error.message,
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to retry execution',
      });
    }
  }

  async cancelExecution(
    request: FastifyRequest<{ Params: { executionId: string } }>,
    reply: FastifyReply
  ) {
    const { executionId } = request.params;

    try {
      await this.executionService.cancelPendingExecution(executionId);

      logger.info('Execution cancelled', { executionId });

      return reply.send({
        success: true,
        message: 'Execution cancelled successfully',
      });
    } catch (error: any) {
      if (error.statusCode === 404) {
        return reply.status(404).send({
          success: false,
          error: 'Execution not found',
        });
      }

      if (error.statusCode === 400) {
        return reply.status(400).send({
          success: false,
          error: error.message,
        });
      }

      logger.error('Failed to cancel execution', {
        executionId,
        error: error.message,
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to cancel execution',
      });
    }
  }

  async getExecutionReport(
    request: FastifyRequest<{ Params: { executionId: string } }>,
    reply: FastifyReply
  ) {
    const { executionId } = request.params;

    try {
      const report = await this.executionService.getExecutionReport(executionId);

      logger.debug('Generated execution report', { executionId });

      return reply.send({
        success: true,
        data: report,
      });
    } catch (error: any) {
      if (error.statusCode === 404) {
        return reply.status(404).send({
          success: false,
          error: 'Execution not found',
        });
      }

      logger.error('Failed to generate execution report', {
        executionId,
        error: error.message,
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to generate execution report',
      });
    }
  }

  async approveVisualDiff(
    request: FastifyRequest<{ Params: { diffId: string }, Body: { approved: boolean; reason?: string } }>,
    reply: FastifyReply
  ) {
    const { diffId } = request.params;
    const { approved, reason } = request.body;

    if (!this.visualDiffService) {
      return reply.status(501).send({
        success: false,
        error: 'Visual diff service not available',
      });
    }

    try {
      const visualDiff = await this.visualDiffService['visualDiffRepo'].updateApproval(
        diffId,
        approved
      );

      logger.info('Visual diff approval updated', {
        diffId,
        approved,
        reason,
      });

      return reply.send({
        success: true,
        data: visualDiff,
      });
    } catch (error: any) {
      logger.error('Failed to approve visual diff', {
        diffId,
        error: error.message,
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to update visual diff approval',
      });
    }
  }

  async getDiffHeatmap(
    request: FastifyRequest<{ Params: { diffId: string } }>,
    reply: FastifyReply
  ) {
    const { diffId } = request.params;

    if (!this.visualDiffService) {
      return reply.status(501).send({
        success: false,
        error: 'Visual diff service not available',
      });
    }

    try {
      const heatmapKey = await this.visualDiffService.getDiffHeatmap(diffId);

      logger.info('Generated diff heatmap', { diffId, heatmapKey });

      return reply.send({
        success: true,
        data: { heatmapKey },
      });
    } catch (error: any) {
      logger.error('Failed to generate diff heatmap', {
        diffId,
        error: error.message,
      });

      return reply.status(500).send({
        success: false,
        error: 'Failed to generate diff heatmap',
      });
    }
  }
}