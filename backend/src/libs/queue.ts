import { Queue, Worker, Job, QueueEvents } from 'bullmq';
import IORedis from 'ioredis';
import { redisClient } from './redis';
import { logger } from '@/utils/logger';
import { config } from '@/config';

export interface JobData {
  id: string;
  type: string;
  data: any;
  options?: {
    delay?: number;
    priority?: number;
    attempts?: number;
    backoff?: {
      type: 'fixed' | 'exponential';
      delay: number;
    };
  };
}

export interface ExecutionJobData {
  executionId: string;
  scriptId: string;
  environment: string;
  triggeredBy: string;
  nodeId?: string;
}

export class QueueService {
  private redisConnection: IORedis;
  private executionQueue: Queue;
  private notificationQueue: Queue;
  private cleanupQueue: Queue;
  private workers: Worker[] = [];

  constructor() {
    this.redisConnection = redisClient.getClient() as IORedis;
    this.setupQueues();
    this.setupWorkers();
    this.setupErrorHandling();
  }

  private setupQueues(): void {
    // Execution queue for script execution jobs
    this.executionQueue = new Queue('execution', {
      connection: this.redisConnection,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    });

    // Notification queue for system notifications
    this.notificationQueue = new Queue('notifications', {
      connection: this.redisConnection,
      defaultJobOptions: {
        removeOnComplete: 10,
        removeOnFail: 5,
        attempts: 2,
      },
    });

    // Cleanup queue for maintenance tasks
    this.cleanupQueue = new Queue('cleanup', {
      connection: this.redisConnection,
      defaultJobOptions: {
        removeOnComplete: 1,
        removeOnFail: 1,
        attempts: 1,
      },
    });

    logger.info('Queues initialized', {
      execution: this.executionQueue.name,
      notifications: this.notificationQueue.name,
      cleanup: this.cleanupQueue.name,
    });
  }

  private setupWorkers(): void {
    // Execution worker
    const executionWorker = new Worker(
      'execution',
      async (job: Job<ExecutionJobData>) => {
        return this.processExecutionJob(job);
      },
      {
        connection: this.redisConnection,
        concurrency: config.queue.maxJobsPerWorker,
      }
    );

    // Notification worker
    const notificationWorker = new Worker(
      'notifications',
      async (job: Job<any>) => {
        return this.processNotificationJob(job);
      },
      {
        connection: this.redisConnection,
        concurrency: 5,
      }
    );

    // Cleanup worker
    const cleanupWorker = new Worker(
      'cleanup',
      async (job: Job<any>) => {
        return this.processCleanupJob(job);
      },
      {
        connection: this.redisConnection,
        concurrency: 1,
      }
    );

    this.workers.push(executionWorker, notificationWorker, cleanupWorker);

    this.workers.forEach((worker, index) => {
      worker.on('completed', (job) => {
        logger.debug('Job completed', {
          queue: job.queue.name,
          jobId: job.id,
          index,
        });
      });

      worker.on('failed', (job, err) => {
        logger.error('Job failed', {
          queue: job.queue.name,
          jobId: job.id,
          error: err.message,
          index,
        });
      });
    });

    logger.info('Workers initialized', { workerCount: this.workers.length });
  }

  private async processExecutionJob(job: Job<ExecutionJobData>): Promise<any> {
    const { executionId, scriptId, environment, triggeredBy, nodeId } = job.data;

    logger.info('Processing execution job', {
      jobId: job.id,
      executionId,
      scriptId,
      environment,
    });

    try {
      // Import here to avoid circular dependencies
      const { PlaywrightDriver } = await import('../agent/driver');
      const driver = new PlaywrightDriver();

      // Execute the script
      const result = await driver.executeScript({
        executionId,
        scriptId,
        environment,
        nodeId,
      });

      logger.info('Execution job completed', {
        jobId: job.id,
        executionId,
        status: result.status,
        duration: result.duration,
      });

      return result;
    } catch (error) {
      logger.error('Execution job failed', {
        jobId: job.id,
        executionId,
        error: error.message,
      });

      // Re-throw to let BullMQ handle retries
      throw error;
    }
  }

  private async processNotificationJob(job: Job<any>): Promise<void> {
    const { type, data, recipients } = job.data;

    logger.debug('Processing notification job', {
      jobId: job.id,
      type,
      recipients,
    });

    // In a real implementation, this would send notifications via:
    // - Email
    // - Slack/Teams
    // - Push notifications
    // - Webhooks

    switch (type) {
      case 'execution_completed':
        await this.handleExecutionCompletedNotification(data);
        break;
      case 'execution_failed':
        await this.handleExecutionFailedNotification(data);
        break;
      case 'node_offline':
        await this.handleNodeOfflineNotification(data);
        break;
      case 'system_alert':
        await this.handleSystemAlertNotification(data);
        break;
      default:
        logger.warn('Unknown notification type', { type });
    }
  }

  private async processCleanupJob(job: Job<any>): Promise<void> {
    const { type, options } = job.data;

    logger.info('Processing cleanup job', {
      jobId: job.id,
      type,
      options,
    });

    switch (type) {
      case 'old_executions':
        await this.cleanupOldExecutions(options?.retentionDays);
        break;
      case 'old_logs':
        await this.cleanupOldLogs(options?.retentionDays);
        break;
      case 'old_visual_diffs':
        await this.cleanupOldVisualDiffs(options?.retentionDays);
        break;
      default:
        logger.warn('Unknown cleanup type', { type });
    }
  }

  private async handleExecutionCompletedNotification(data: any): Promise<void> {
    // Send notification about successful execution
    logger.info('Execution completed notification', data);
  }

  private async handleExecutionFailedNotification(data: any): Promise<void> {
    // Send notification about failed execution
    logger.warn('Execution failed notification', data);
  }

  private async handleNodeOfflineNotification(data: any): Promise<void> {
    // Send notification about node going offline
    logger.warn('Node offline notification', data);
  }

  private async handleSystemAlertNotification(data: any): Promise<void> {
    // Send system alert
    logger.error('System alert', data);
  }

  async addExecutionJob(data: ExecutionJobData): Promise<Job<ExecutionJobData>> {
    const job = await this.executionQueue.add(
      'execute-script',
      data,
      {
        priority: this.getPriorityFromScriptPriority(data.scriptId),
        delay: data.options?.delay,
        removeOnComplete: true,
      }
    );

    logger.info('Execution job added to queue', {
      jobId: job.id,
      executionId: data.executionId,
      priority: job.opts.priority,
    });

    return job;
  }

  async removeExecutionJob(executionId: string): Promise<boolean> {
    const jobs = await this.executionQueue.getJobs(['waiting', 'delayed']);
    const jobToRemove = jobs.find(job => job.data.executionId === executionId);

    if (jobToRemove) {
      await jobToRemove.remove();
      logger.info('Execution job removed from queue', {
        jobId: jobToRemove.id,
        executionId,
      });
      return true;
    }

    return false;
  }

  async addNotificationJob(type: string, data: any, options?: any): Promise<Job<any>> {
    const job = await this.notificationQueue.add(
      type,
      {
        type,
        data,
        ...options,
      },
      {
        delay: options?.delay,
        priority: options?.priority || 5,
      }
    );

    return job;
  }

  async addCleanupJob(type: string, options?: any): Promise<Job<any>> {
    const job = await this.cleanupQueue.add(
      type,
      {
        type,
        options,
      },
      {
        delay: options?.delay || 0,
      }
    );

    return job;
  }

  private getPriorityFromScriptPriority(scriptId: string): number {
    // In a real implementation, you'd fetch the script to get its priority
    // For now, use a default priority
    return 5; // Default priority
  }

  async getQueueStats(): Promise<{
    execution: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
    notifications: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
    cleanup: {
      waiting: number;
      active: number;
      completed: number;
      failed: number;
    };
  }> {
    const [executionCounts, notificationCounts, cleanupCounts] = await Promise.all([
      this.getQueueCounts(this.executionQueue),
      this.getQueueCounts(this.notificationQueue),
      this.getQueueCounts(this.cleanupQueue),
    ]);

    return {
      execution: executionCounts,
      notifications: notificationCounts,
      cleanup: cleanupCounts,
    };
  }

  private async getQueueCounts(queue: Queue): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  }> {
    const [waiting, active, completed, failed] = await Promise.all([
      queue.getWaiting(),
      queue.getActive(),
      queue.getCompleted(),
      queue.getFailed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
    };
  }

  async pauseQueue(queueName?: string): Promise<void> {
    if (queueName === 'execution') {
      await this.executionQueue.pause();
    } else if (queueName === 'notifications') {
      await this.notificationQueue.pause();
    } else if (queueName === 'cleanup') {
      await this.cleanupQueue.pause();
    } else {
      // Pause all queues
      await Promise.all([
        this.executionQueue.pause(),
        this.notificationQueue.pause(),
        this.cleanupQueue.pause(),
      ]);
    }

    logger.info('Queue paused', { queueName });
  }

  async resumeQueue(queueName?: string): Promise<void> {
    if (queueName === 'execution') {
      await this.executionQueue.resume();
    } else if (queueName === 'notifications') {
      await this.notificationQueue.resume();
    } else if (queueName === 'cleanup') {
      await this.cleanupQueue.resume();
    } else {
      // Resume all queues
      await Promise.all([
        this.executionQueue.resume(),
        this.notificationQueue.resume(),
        this.cleanupQueue.resume(),
      ]);
    }

    logger.info('Queue resumed', { queueName });
  }

  async clearQueue(queueName: string): Promise<void> {
    let queue: Queue;

    switch (queueName) {
      case 'execution':
        queue = this.executionQueue;
        break;
      case 'notifications':
        queue = this.notificationQueue;
        break;
      case 'cleanup':
        queue = this.cleanupQueue;
        break;
      default:
        throw new Error(`Unknown queue: ${queueName}`);
    }

    await queue.drain();

    logger.info('Queue cleared', { queueName });
  }

  private setupErrorHandling(): void {
    this.executionQueue.on('error', (err) => {
      logger.error('Execution queue error', { error: err.message });
    });

    this.notificationQueue.on('error', (err) => {
      logger.error('Notification queue error', { error: err.message });
    });

    this.cleanupQueue.on('error', (err) => {
      logger.error('Cleanup queue error', { error: err.message });
    });

    // Handle stalled jobs
    this.executionQueue.on('stalled', (job) => {
      logger.error('Execution job stalled', {
        jobId: job.id,
        data: job.data,
      });
    });
  }

  private async cleanupOldExecutions(retentionDays: number): Promise<void> {
    logger.info('Cleaning up old executions', { retentionDays });

    // In a real implementation, this would:
    // 1. Mark old executions as archived
    // 2. Move old logs to cold storage
    // 3. Clean up old visual diffs
    // 4. Archive trace files

    // For now, we'll just log the action
    logger.info('Old executions cleanup completed');
  }

  private async cleanupOldLogs(retentionDays: number): Promise<void> {
    logger.info('Cleaning up old logs', { retentionDays });
    // Implementation would clean up old log entries
    logger.info('Old logs cleanup completed');
  }

  private async cleanupOldVisualDiffs(retentionDays: number): Promise<void> {
    logger.info('Cleaning up old visual diffs', { retentionDays });
    // Implementation would clean up old visual diffs
    logger.info('Old visual diffs cleanup completed');
  }

  // Schedule periodic cleanup jobs
  schedulePeriodicCleanup(): void {
    // Schedule cleanup jobs to run daily
    const scheduleJob = (type: string, cronExpression: string, options?: any) => {
      this.addCleanupJob(type, {
        ...options,
        repeat: { pattern: cronExpression },
      });
    };

    // Clean up old executions daily at 2 AM
    scheduleJob('old_executions', '0 2 * * *');

    // Clean up old logs weekly on Sunday at 3 AM
    scheduleJob('old_logs', '0 3 * * 0');

    // Clean up old visual diffs monthly on the 1st at 4 AM
    scheduleJob('old_visual_diffs', '0 4 1 * *');

    logger.info('Periodic cleanup jobs scheduled');
  }

  async close(): Promise<void> {
    // Close all workers
    await Promise.all(this.workers.map(worker => worker.close()));

    // Close all queues
    await Promise.all([
      this.executionQueue.close(),
      this.notificationQueue.close(),
      this.cleanupQueue.close(),
    ]);

    logger.info('Queue service closed');
  }
}