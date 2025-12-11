import { Queue, Job, Worker } from 'bullmq';
import { PrismaClient, Execution, ExecutionStatus } from '@prisma/client';
import { NodeService } from '../modules/node/service';
import { WebSocketService } from '../libs/websocket';
import { logger } from '../utils/logger';
import { redis } from '../config/redis';

export interface TestExecutionJob {
  executionId: string;
  testSuiteId: string;
  baseUrl: string;
  capabilities: Array<{
    browser: string;
    version?: string;
    platform?: string;
  }>;
  testFiles?: string[];
  options?: {
    timeout?: number;
    retries?: number;
    parallel?: number;
    headless?: boolean;
    screenshots?: boolean;
    videos?: boolean;
  };
}

export interface JobResult {
  success: boolean;
  executionId: string;
  nodeId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  status: ExecutionStatus;
  error?: string;
  results?: {
    total: number;
    passed: number;
    failed: number;
    skipped: number;
    screenshots: string[];
    videos: string[];
    artifacts: Array<{
      type: 'screenshot' | 'video' | 'trace' | 'har';
      path: string;
      test?: string;
    }>;
  };
}

export class JobDispatcher {
  private dispatchQueue: Queue<TestExecutionJob>;
  private resultQueue: Queue<JobResult>;
  private worker: Worker<TestExecutionJob, JobResult>;
  private isRunning = false;

  constructor(
    private prisma: PrismaClient,
    private nodeService: NodeService,
    private wsService: WebSocketService
  ) {
    // Initialize queues
    this.dispatchQueue = new Queue<TestExecutionJob>('test-execution', {
      connection: redis,
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

    this.resultQueue = new Queue<JobResult>('test-results', {
      connection: redis,
      defaultJobOptions: {
        removeOnComplete: 200,
        removeOnFail: 100,
      },
    });

    // Initialize worker
    this.worker = new Worker<TestExecutionJob, JobResult>(
      'test-execution',
      this.processJob.bind(this),
      {
        connection: redis,
        concurrency: 5,
      }
    );

    // Set up event listeners
    this.setupEventListeners();
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Job dispatcher already running');
      return;
    }

    logger.info('Starting job dispatcher');
    this.isRunning = true;
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Job dispatcher not running');
      return;
    }

    logger.info('Stopping job dispatcher');
    this.isRunning = false;

    await this.worker.close();
    await this.dispatchQueue.close();
    await this.resultQueue.close();
  }

  /**
   * Dispatch a test execution job
   */
  async dispatchTestExecution(jobData: TestExecutionJob): Promise<Job<TestExecutionJob>> {
    logger.info('Dispatching test execution', {
      executionId: jobData.executionId,
      capabilities: jobData.capabilities,
    });

    // Update execution status to QUEUED
    await this.prisma.execution.update({
      where: { id: jobData.executionId },
      data: { status: 'QUEUED' },
    });

    // Notify about queued job
    this.wsService.emitExecutionUpdate(jobData.executionId, {
      status: 'QUEUED',
      timestamp: new Date(),
    });

    // Add to queue
    return this.dispatchQueue.add('execute-test', jobData, {
      priority: this.calculatePriority(jobData),
      delay: 0,
    });
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      this.dispatchQueue.getWaiting(),
      this.dispatchQueue.getActive(),
      this.dispatchQueue.getCompleted(),
      this.dispatchQueue.getFailed(),
      this.dispatchQueue.getDelayed(),
    ]);

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      delayed: delayed.length,
    };
  }

  /**
   * Cancel a queued job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    try {
      const job = await this.dispatchQueue.getJob(jobId);
      if (!job) {
        return false;
      }

      if (job.finished || job.failed) {
        return false;
      }

      await job.remove();

      // Update execution status
      await this.prisma.execution.update({
        where: { id: job.data.executionId },
        data: { status: 'CANCELLED' },
      });

      logger.info('Job cancelled', { jobId, executionId: job.data.executionId });
      return true;
    } catch (error) {
      logger.error('Failed to cancel job', { jobId, error: error.message });
      return false;
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(executionId: string): Promise<boolean> {
    try {
      const execution = await this.prisma.execution.findUnique({
        where: { id: executionId },
      });

      if (!execution) {
        return false;
      }

      // Reset execution status
      await this.prisma.execution.update({
        where: { id: executionId },
        data: {
          status: 'QUEUED',
          startTime: null,
          endTime: null,
          durationMs: null,
        },
      });

      // Create new job
      await this.dispatchTestExecution({
        executionId,
        testSuiteId: execution.testSuiteId,
        baseUrl: execution.baseUrl,
        capabilities: JSON.parse(execution.capabilities as string),
        options: JSON.parse(execution.options as string),
      });

      logger.info('Job retried', { executionId });
      return true;
    } catch (error) {
      logger.error('Failed to retry job', { executionId, error: error.message });
      return false;
    }
  }

  private async processJob(job: Job<TestExecutionJob>): Promise<JobResult> {
    const jobData = job.data;
    const startTime = new Date();

    logger.info('Processing test execution job', {
      jobId: job.id,
      executionId: jobData.executionId,
    });

    // Find best node for execution
    const node = await this.nodeService.findBestNode(jobData.capabilities);

    if (!node) {
      const error = 'No available node found matching required capabilities';
      logger.error('No suitable node found', {
        executionId: jobData.executionId,
        capabilities: jobData.capabilities,
      });

      return {
        success: false,
        executionId: jobData.executionId,
        nodeId: '',
        startTime,
        endTime: new Date(),
        duration: 0,
        status: 'FAIL',
        error,
      };
    }

    // Mark node as busy
    await this.nodeService.markNodeBusy(node.id);

    try {
      // Update execution with node info
      await this.prisma.execution.update({
        where: { id: jobData.executionId },
        data: {
          nodeId: node.id,
          status: 'RUNNING',
          startTime,
        },
      });

      // Notify about execution start
      this.wsService.emitExecutionUpdate(jobData.executionId, {
        status: 'RUNNING',
        nodeId: node.id,
        timestamp: startTime,
      });

      // Send job to node via WebSocket
      await this.sendJobToNode(node.id, jobData);

      // Wait for result from node (this would be handled via WebSocket callbacks)
      // For now, we'll simulate execution
      const result = await this.waitForJobResult(jobData.executionId);

      // Update execution with results
      await this.prisma.execution.update({
        where: { id: jobData.executionId },
        data: {
          status: result.status,
          endTime: result.endTime,
          durationMs: result.duration,
        },
      });

      // Log execution
      await this.prisma.executionLog.create({
        data: {
          executionId: jobData.executionId,
          level: result.success ? 'INFO' : 'ERROR',
          message: result.error || 'Test execution completed',
          timestamp: result.endTime,
        },
      });

      return result;
    } catch (error) {
      logger.error('Job processing failed', {
        jobId: job.id,
        executionId: jobData.executionId,
        error: error.message,
      });

      return {
        success: false,
        executionId: jobData.executionId,
        nodeId: node.id,
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime.getTime(),
        status: 'FAIL',
        error: error.message,
      };
    } finally {
      // Mark node as available
      await this.nodeService.markNodeAvailable(node.id);
    }
  }

  private async sendJobToNode(nodeId: string, jobData: TestExecutionJob): Promise<void> {
    // This would send the job to the agent running on the node
    // For now, we'll emit via WebSocket
    this.wsService.emitJobToNode(nodeId, {
      ...jobData,
      timestamp: new Date(),
    });
  }

  private async waitForJobResult(executionId: string): Promise<JobResult> {
    // This would wait for the actual result from the node agent
    // For now, we'll simulate a successful execution
    await new Promise(resolve => setTimeout(resolve, 5000)); // Simulate 5s execution

    return {
      success: true,
      executionId,
      nodeId: '', // Would be filled with actual node ID
      startTime: new Date(Date.now() - 5000),
      endTime: new Date(),
      duration: 5000,
      status: 'PASS',
      results: {
        total: 10,
        passed: 8,
        failed: 2,
        skipped: 0,
        screenshots: [],
        videos: [],
        artifacts: [],
      },
    };
  }

  private calculatePriority(jobData: TestExecutionJob): number {
    // Simple priority calculation based on capabilities
    // Higher priority for Chrome/Chromium
    const hasChrome = jobData.capabilities.some(cap =>
      cap.browser.toLowerCase().includes('chrome')
    );

    return hasChrome ? 10 : 5;
  }

  private setupEventListeners(): void {
    this.worker.on('completed', (job: Job<TestExecutionJob>, result: JobResult) => {
      logger.info('Job completed', {
        jobId: job.id,
        executionId: result.executionId,
        duration: result.duration,
        success: result.success,
      });

      // Add result to result queue
      this.resultQueue.add('job-result', result);
    });

    this.worker.on('failed', (job: Job<TestExecutionJob>, err: Error) => {
      logger.error('Job failed', {
        jobId: job.id,
        executionId: job.data.executionId,
        error: err.message,
      });
    });

    this.worker.on('error', (err: Error) => {
      logger.error('Worker error', { error: err.message });
    });
  }
}