import { PrismaClient, Execution, ExecutionStatus, Script } from '@prisma/client';
import { ExecutionRepository } from './repository';
import { ExecutionLogRepository } from './log-repository';
import { VisualDiffRepository } from './visual-diff-repository';
import { ScriptRepository } from '../script/repository';
import { VisualDiffService } from './visual-diff-service';
import { WebSocketService } from '@/libs/websocket';
import { QueueService } from '@/libs/queue';
import { s3Client } from '@/libs/s3';
import { logger } from '@/utils/logger';
import { createError, badRequest, notFound } from '@/middleware/errorHandler';
import { ExecutionEnvironment } from '@/types';

export interface RunScriptRequest {
  environment: string;
  triggeredBy: string;
  nodeId?: string;
}

export interface ExecutionUpdate {
  status: ExecutionStatus;
  progress?: number;
  stepIndex?: number;
  message?: string;
  error?: string;
  logs?: Array<{
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    message: string;
    stepId?: number;
  }>;
}

export class ExecutionService {
  private executionRepo: ExecutionRepository;
  private logRepo: ExecutionLogRepository;
  private visualDiffRepo: VisualDiffRepository;
  private scriptRepo: ScriptRepository;
  private visualDiffService: VisualDiffService;
  private wsService: WebSocketService;
  private queueService: QueueService;

  constructor(
    prisma: PrismaClient,
    wsService: WebSocketService,
    queueService: QueueService
  ) {
    this.executionRepo = new ExecutionRepository(prisma);
    this.logRepo = new ExecutionLogRepository(prisma);
    this.visualDiffRepo = new VisualDiffRepository(prisma);
    this.scriptRepo = new ScriptRepository(prisma);
    this.visualDiffService = new VisualDiffService(prisma);
    this.wsService = wsService;
    this.queueService = queueService;
  }

  async runScript(scriptId: string, request: RunScriptRequest): Promise<Execution> {
    // Validate script exists
    const script = await this.scriptRepo.findById(scriptId);
    if (!script) {
      throw notFound('Script not found');
    }

    // Validate script steps
    if (!script.steps || script.steps.length === 0) {
      throw badRequest('Script has no steps to execute');
    }

    // Check for existing running executions (optional - based on requirements)
    // const runningExecutions = await this.executionRepo.findRunningExecutions();
    // if (runningExecutions.length > 0) {
    //   throw badRequest('Another execution is already running');
    // }

    // Create execution record
    const execution = await this.executionRepo.create({
      scriptId,
      status: 'PENDING',
      environment: request.environment,
      triggeredBy: request.triggeredBy,
      nodeId: request.nodeId,
    });

    // Update script's last run status to PENDING
    await this.scriptRepo.updateLastRunStatus(scriptId, 'PENDING');

    // Log execution start
    await this.logRepo.createLogWithTimestamp({
      executionId: execution.id,
      level: 'INFO',
      message: `Execution started for script: ${script.name}`,
      stepId: 0,
    });

    // Emit WebSocket event for execution start
    this.wsService.emitExecutionUpdate(execution.id, {
      status: 'PENDING',
      progress: 0,
      stepIndex: 0,
      message: 'Execution queued',
    });

    // Add job to queue for async processing
    await this.queueService.addExecutionJob({
      executionId: execution.id,
      scriptId,
      environment: request.environment,
      triggeredBy: request.triggeredBy,
      nodeId: request.nodeId,
    });

    logger.info('Script execution queued', {
      executionId: execution.id,
      scriptId,
      environment: request.environment,
    });

    return execution;
  }

  async getExecution(executionId: string, include?: string[]): Promise<any> {
    const execution = await this.executionRepo.findWithDetails(executionId, include);

    if (!execution) {
      throw notFound('Execution not found');
    }

    return execution;
  }

  async stopExecution(executionId: string, triggeredBy: string): Promise<void> {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution) {
      throw notFound('Execution not found');
    }

    if (execution.status === 'PASS' || execution.status === 'FAIL' || execution.status === 'TIMEOUT') {
      throw badRequest('Cannot stop completed execution');
    }

    // Update execution status
    await this.executionRepo.markAsCompleted(executionId, 'SKIP');

    // Update script's last run status
    await this.scriptRepo.updateLastRunStatus(execution.scriptId, 'SKIP');

    // Log stop event
    await this.logRepo.createLogWithTimestamp({
      executionId: execution.id,
      level: 'INFO',
      message: `Execution stopped by ${triggeredBy}`,
    });

    // Emit WebSocket event
    this.wsService.emitExecutionUpdate(executionId, {
      status: 'SKIP',
      progress: 100,
      message: 'Execution stopped by user',
    });

    // Remove from queue if pending
    if (execution.status === 'PENDING') {
      await this.queueService.removeExecutionJob(executionId);
    }

    logger.info('Execution stopped', { executionId, triggeredBy });
  }

  async updateExecution(executionId: string, update: ExecutionUpdate): Promise<void> {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution) {
      throw notFound('Execution not found');
    }

    // Update execution status if changed
    if (update.status && update.status !== execution.status) {
      if (update.status === 'RUNNING' && execution.status === 'PENDING') {
        await this.executionRepo.markAsRunning(executionId);
      } else if (
        ['PASS', 'FAIL', 'TIMEOUT'].includes(update.status) &&
        execution.status !== 'PASS' &&
        execution.status !== 'FAIL' &&
        execution.status !== 'TIMEOUT'
      ) {
        await this.executionRepo.markAsCompleted(executionId, update.status);

        // Update script's last run status
        await this.scriptRepo.updateLastRunStatus(execution.scriptId, update.status);
      }
    }

    // Create logs if provided
    if (update.logs) {
      const logsToCreate = update.logs.map(log => ({
        executionId,
        level: log.level,
        message: log.message,
        stepId: log.stepId,
      }));

      await this.logRepo.createBatch(logsToCreate);
    }

    // Create error log if error provided
    if (update.error) {
      await this.logRepo.createLogWithTimestamp({
        executionId,
        level: 'ERROR',
        message: update.error,
      });
    }

    // Emit WebSocket update
    this.wsService.emitExecutionUpdate(executionId, {
      status: update.status || execution.status,
      progress: update.progress,
      stepIndex: update.stepIndex,
      message: update.message,
    });

    // If execution is completed, calculate quality score
    if (update.status === 'PASS' || update.status === 'FAIL') {
      await this.calculateQualityScore(executionId);
    }
  }

  private async calculateQualityScore(executionId: string): Promise<void> {
    // Get execution logs
    const logs = await this.logRepo.findByExecution(executionId);
    const execution = await this.executionRepo.findById(executionId);

    if (!execution) return;

    // Simple quality score calculation
    // Could be enhanced with more sophisticated algorithms
    let score = 100;

    // Deduct points for errors
    const errorCount = logs.filter(log => log.level === 'ERROR').length;
    score -= errorCount * 20;

    // Deduct points for warnings
    const warnCount = logs.filter(log => log.level === 'WARN').length;
    score -= warnCount * 5;

    // Deduct points for timeouts
    if (execution.status === 'TIMEOUT') {
      score -= 30;
    }

    // Ensure score is within 0-100 range
    score = Math.max(0, Math.min(100, score));

    // Update execution with quality score
    await this.executionRepo.update(executionId, { qualityScore: score });
  }

  async getExecutionLogs(
    executionId: string,
    page: number = 1,
    limit: number = 100,
    level?: string,
    stepId?: number
  ): Promise<{
    data: any[];
    pagination: any;
  }> {
    // Verify execution exists
    const execution = await this.executionRepo.findById(executionId);
    if (!execution) {
      throw notFound('Execution not found');
    }

    return this.logRepo.findByExecutionWithPagination(executionId, page, limit, level, stepId);
  }

  async getExecutions(
    filters: {
      scriptId?: string;
      status?: ExecutionStatus;
      startDate?: Date;
      endDate?: Date;
      page?: number;
      limit?: number;
    }
  ): Promise<{
    data: Execution[];
    pagination?: any;
  }> {
    let result;

    if (filters.startDate && filters.endDate) {
      result = await this.executionRepo.findByDateRange(
        filters.startDate,
        filters.endDate,
        filters.page || 1,
        filters.limit || 10
      );
    } else if (filters.status) {
      result = await this.executionRepo.findByStatus(
        filters.status,
        filters.page || 1,
        filters.limit || 10
      );
    } else {
      // Get all with pagination
      const page = filters.page || 1;
      const limit = filters.limit || 10;
      const skip = (page - 1) * limit;

      const [executions, total] = await Promise.all([
        this.executionRepo.findMany({
          where: filters.scriptId ? { scriptId: filters.scriptId } : {},
          skip,
          take: limit,
          orderBy: { startTime: 'desc' },
          include: {
            script: {
              select: {
                id: true,
                name: true,
                priority: true,
              },
            },
          },
        }),
        this.executionRepo.count({
          where: filters.scriptId ? { scriptId: filters.scriptId } : {},
        }),
      ]);

      result = {
        data: executions,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    }

    return result;
  }

  async getVisualDiffs(executionId: string): Promise<any[]> {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution) {
      throw notFound('Execution not found');
    }

    return this.visualDiffRepo.findByExecution(executionId);
  }

  async getExecutionStats(filter?: {
    scriptId?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<any> {
    return this.executionRepo.getExecutionStats(filter);
  }

  async getRecentExecutions(limit: number = 10): Promise<Execution[]> {
    return this.executionRepo.getRecentExecutions(limit);
  }

  async cleanupOldExecutions(): Promise<{
    executionsDeleted: number;
    logsDeleted: number;
    diffsDeleted: number;
  }> {
    const retentionDays = 90; // From configuration

    const [executionsDeleted, logsDeleted, diffsDeleted] = await Promise.all([
      this.executionRepo.cleanupOldExecutions(retentionDays),
      this.logRepo.deleteOldLogs(retentionDays),
      this.visualDiffRepo.deleteOldDiffs(retentionDays),
    ]);

    logger.info('Cleanup completed', {
      executionsDeleted,
      logsDeleted,
      diffsDeleted,
      retentionDays,
    });

    return {
      executionsDeleted,
      logsDeleted,
      diffsDeleted,
    };
  }

  async retryFailedExecution(executionId: string, triggeredBy: string): Promise<Execution> {
    const originalExecution = await this.executionRepo.findById(executionId);
    if (!originalExecution) {
      throw notFound('Execution not found');
    }

    if (originalExecution.status !== 'FAIL') {
      throw badRequest('Can only retry failed executions');
    }

    // Create new execution with same parameters
    const newExecution = await this.runScript(originalExecution.scriptId, {
      environment: originalExecution.environment,
      triggeredBy,
      nodeId: originalExecution.nodeId,
    });

    // Add context about retry
    await this.logRepo.createLogWithTimestamp({
      executionId: newExecution.id,
      level: 'INFO',
      message: `Retrying execution from failed execution ${executionId}`,
    });

    return newExecution;
  }

  async cancelPendingExecution(executionId: string): Promise<void> {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution) {
      throw notFound('Execution not found');
    }

    if (execution.status !== 'PENDING') {
      throw badRequest('Can only cancel pending executions');
    }

    // Update execution to SKIP
    await this.executionRepo.updateStatus(executionId, 'SKIP');

    // Remove from queue
    await this.queueService.removeExecutionJob(executionId);

    // Log cancellation
    await this.logRepo.createLogWithTimestamp({
      executionId: execution.id,
      level: 'INFO',
      message: 'Execution cancelled',
    });

    // Emit update
    this.wsService.emitExecutionUpdate(executionId, {
      status: 'SKIP',
      progress: 100,
      message: 'Execution cancelled',
    });
  }

  async getExecutionReport(executionId: string): Promise<{
    execution: any;
    logs: any[];
    visualDiffs: any[];
    stats: any;
  }> {
    const execution = await this.getExecution(executionId, 'logs,diffs,node');
    const logs = await this.logRepo.findByExecution(executionId);
    const visualDiffs = await this.visualDiffRepo.findByExecution(executionId);
    const stats = await this.getExecutionStats({ scriptId: execution.scriptId });

    return {
      execution,
      logs,
      visualDiffs,
      stats,
    };
  }

  async updateExecutionEnvironment(executionId: string, environment: ExecutionEnvironment): Promise<void> {
    const execution = await this.executionRepo.findById(executionId);
    if (!execution) {
      throw notFound('Execution not found');
    }

    if (execution.status !== 'PENDING') {
      throw badRequest('Can only update environment for pending executions');
    }

    // In a real implementation, you might update node selection based on environment requirements
    await this.logRepo.createLogWithTimestamp({
      executionId,
      level: 'INFO',
      message: `Execution environment updated: ${environment.browser} ${environment.version} (${environment.platform})`,
    });
  }
}