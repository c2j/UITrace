import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { chromium, firefox, webkit, Browser, Page } from 'playwright';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface NodeConfig {
  nodeId?: string;
  name: string;
  serverUrl: string;
  apiToken: string;
  capabilities: Array<{
    browser: string;
    version?: string;
    platform?: string;
  }>;
  heartbeatInterval?: number;
  maxConcurrentExecutions?: number;
  workDir?: string;
}

export interface TestJob {
  executionId: string;
  testSuiteId: string;
  baseUrl: string;
  capabilities: {
    browser: string;
    version?: string;
    platform?: string;
  };
  testFiles?: string[];
  options?: {
    timeout?: number;
    retries?: number;
    parallel?: number;
    headless?: boolean;
    screenshots?: boolean;
    videos?: boolean;
  };
  timestamp: Date;
}

export interface TestResult {
  success: boolean;
  executionId: string;
  nodeId: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  status: 'PASS' | 'FAIL';
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

export class UITraceAgent extends EventEmitter {
  private ws: WebSocket | null = null;
  private nodeId: string;
  private config: NodeConfig;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private browsers: Map<string, Browser> = new Map();
  private activeExecutions: Map<string, Promise<void>> = new Map();
  private isRunning = false;
  private workDir: string;

  constructor(config: NodeConfig) {
    super();
    this.config = {
      heartbeatInterval: 30000, // 30 seconds
      maxConcurrentExecutions: 2,
      workDir: './agent-workspace',
      ...config,
    };
    this.nodeId = config.nodeId || uuidv4();
    this.workDir = path.resolve(this.config.workDir || './agent-workspace');
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Agent already running');
      return;
    }

    try {
      // Create work directory
      await fs.mkdir(this.workDir, { recursive: true });

      // Initialize browsers
      await this.initializeBrowsers();

      // Connect to server
      await this.connect();

      // Register node
      await this.registerNode();

      // Start heartbeat
      this.startHeartbeat();

      this.isRunning = true;
      logger.info('UITrace Agent started', {
        nodeId: this.nodeId,
        name: this.config.name,
        capabilities: this.config.capabilities,
      });

      this.emit('started');
    } catch (error) {
      logger.error('Failed to start agent', { error: error.message });
      throw error;
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      logger.warn('Agent not running');
      return;
    }

    logger.info('Stopping UITrace Agent');

    this.isRunning = false;

    // Stop heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Close WebSocket
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    // Wait for active executions to complete
    const executions = Array.from(this.activeExecutions.values());
    if (executions.length > 0) {
      logger.info('Waiting for active executions to complete', {
        count: executions.length,
      });
      await Promise.allSettled(executions);
    }

    // Close browsers
    await this.closeBrowsers();

    logger.info('UITrace Agent stopped');
    this.emit('stopped');
  }

  private async initializeBrowsers(): Promise<void> {
    const browserTypes = {
      chrome: chromium,
      chromium: chromium,
      firefox: firefox,
      safari: webkit,
      webkit: webkit,
    };

    for (const capability of this.config.capabilities) {
      const browserType = browserTypes[capability.browser.toLowerCase()];
      if (!browserType) {
        logger.warn('Unsupported browser type', { browser: capability.browser });
        continue;
      }

      try {
        const browser = await browserType.launch({
          headless: this.config.options?.headless ?? true,
        });

        this.browsers.set(capability.browser.toLowerCase(), browser);
        logger.info('Browser initialized', {
          browser: capability.browser,
          version: capability.version,
        });
      } catch (error) {
        logger.error('Failed to initialize browser', {
          browser: capability.browser,
          error: error.message,
        });
      }
    }

    if (this.browsers.size === 0) {
      throw new Error('No browsers could be initialized');
    }
  }

  private async closeBrowsers(): Promise<void> {
    const closePromises = Array.from(this.browsers.values()).map(browser =>
      browser.close()
    );

    await Promise.allSettled(closePromises);
    this.browsers.clear();
  }

  private async connect(): Promise<void> {
    const wsUrl = `${this.config.serverUrl.replace('http', 'ws')}/agent/${this.nodeId}`;

    this.ws = new WebSocket(wsUrl, {
      headers: {
        'Authorization': `Bearer ${this.config.apiToken}`,
      },
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.ws!.on('open', () => {
        clearTimeout(timeout);
        logger.info('Connected to server', { url: wsUrl });
        resolve();
      });

      this.ws!.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.ws!.on('message', this.handleMessage.bind(this));
      this.ws!.on('close', (code, reason) => {
        logger.warn('WebSocket connection closed', { code, reason: reason.toString() });
        this.emit('disconnected');
      });
    });
  }

  private async handleMessage(data: WebSocket.Data): Promise<void> {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case 'job':
          await this.handleJob(message.data as TestJob);
          break;

        case 'cancel':
          await this.handleCancel(message.data.executionId);
          break;

        default:
          logger.warn('Unknown message type', { type: message.type });
      }
    } catch (error) {
      logger.error('Failed to handle message', { error: error.message });
    }
  }

  private async handleJob(job: TestJob): Promise<void> {
    if (this.activeExecutions.size >= (this.config.maxConcurrentExecutions || 2)) {
      logger.warn('Too many active executions', {
        current: this.activeExecutions.size,
        max: this.config.maxConcurrentExecutions,
      });
      return;
    }

    if (this.activeExecutions.has(job.executionId)) {
      logger.warn('Execution already active', { executionId: job.executionId });
      return;
    }

    const execution = this.executeTest(job)
      .then((result) => {
        this.sendResult(result);
      })
      .catch((error) => {
        logger.error('Test execution failed', {
          executionId: job.executionId,
          error: error.message,
        });

        this.sendResult({
          success: false,
          executionId: job.executionId,
          nodeId: this.nodeId,
          startTime: new Date(),
          endTime: new Date(),
          duration: 0,
          status: 'FAIL',
          error: error.message,
        });
      })
      .finally(() => {
        this.activeExecutions.delete(job.executionId);
      });

    this.activeExecutions.set(job.executionId, execution);
  }

  private async handleCancel(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      // Note: Actual cancellation would need more sophisticated handling
      logger.info('Received cancellation request', { executionId });
    }
  }

  private async executeTest(job: TestJob): Promise<TestResult> {
    const startTime = new Date();
    const browser = this.browsers.get(job.capabilities.browser.toLowerCase());

    if (!browser) {
      throw new Error(`Browser not available: ${job.capabilities.browser}`);
    }

    logger.info('Starting test execution', {
      executionId: job.executionId,
      browser: job.capabilities.browser,
      baseUrl: job.baseUrl,
    });

    const executionDir = path.join(this.workDir, job.executionId);
    await fs.mkdir(executionDir, { recursive: true });

    try {
      // Create browser context
      const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        recordVideo: job.options?.videos ? { dir: executionDir } : undefined,
      });

      const screenshots: string[] = [];
      const artifacts: Array<{ type: string; path: string; test?: string }> = [];
      let total = 0;
      let passed = 0;
      let failed = 0;
      let skipped = 0;

      try {
        // Simulate test execution
        // In a real implementation, this would parse and run actual test files
        const page = await context.newPage();

        // Navigate to base URL
        await page.goto(job.baseUrl, { timeout: job.options?.timeout || 30000 });

        // Take initial screenshot
        if (job.options?.screenshots) {
          const screenshotPath = path.join(executionDir, 'initial.png');
          await page.screenshot({ path: screenshotPath, fullPage: true });
          screenshots.push(screenshotPath);
          artifacts.push({
            type: 'screenshot',
            path: screenshotPath,
            test: 'initial',
          });
        }

        // Simulate running tests
        const testFiles = job.testFiles || ['sample.test.js'];
        total = testFiles.length;

        for (const testFile of testFiles) {
          try {
            // Simulate test execution
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Take screenshot after each test
            if (job.options?.screenshots) {
              const screenshotName = `${testFile.replace('.test.js', '')}.png`;
              const screenshotPath = path.join(executionDir, screenshotName);
              await page.screenshot({ path: screenshotPath });
              screenshots.push(screenshotPath);
              artifacts.push({
                type: 'screenshot',
                path: screenshotPath,
                test: testFile,
              });
            }

            // Randomly pass/fail for simulation
            if (Math.random() > 0.2) {
              passed++;
            } else {
              failed++;
              throw new Error(`Test ${testFile} failed`);
            }
          } catch (error) {
            logger.warn('Test failed', { testFile, error: error.message });
          }
        }

        skipped = total - passed - failed;
      } finally {
        await context.close();
      }

      // Collect video files
      const videos: string[] = [];
      if (job.options?.videos) {
        const videoDir = path.join(executionDir, 'videos');
        try {
          const videoFiles = await fs.readdir(videoDir);
          videos.push(...videoFiles.map(f => path.join(videoDir, f)));
        } catch (error) {
          // No videos recorded
        }
      }

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      return {
        success: failed === 0,
        executionId: job.executionId,
        nodeId: this.nodeId,
        startTime,
        endTime,
        duration,
        status: failed === 0 ? 'PASS' : 'FAIL',
        results: {
          total,
          passed,
          failed,
          skipped,
          screenshots,
          videos,
          artifacts,
        },
      };
    } catch (error) {
      return {
        success: false,
        executionId: job.executionId,
        nodeId: this.nodeId,
        startTime,
        endTime: new Date(),
        duration: Date.now() - startTime.getTime(),
        status: 'FAIL',
        error: error.message,
      };
    }
  }

  private sendResult(result: TestResult): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      logger.error('WebSocket not connected, cannot send result');
      return;
    }

    this.ws.send(JSON.stringify({
      type: 'result',
      data: result,
    }));

    logger.info('Test result sent', {
      executionId: result.executionId,
      success: result.success,
      duration: result.duration,
    });
  }

  private async registerNode(): Promise<void> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const registration = {
      type: 'register',
      data: {
        nodeId: this.nodeId,
        name: this.config.name,
        capabilities: this.config.capabilities,
        os: process.platform,
      },
    };

    this.ws.send(JSON.stringify(registration));
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
    }, this.config.heartbeatInterval);

    // Send initial heartbeat
    this.sendHeartbeat();
  }

  private sendHeartbeat(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const heartbeat = {
      type: 'heartbeat',
      data: {
        nodeId: this.nodeId,
        timestamp: new Date(),
        activeExecutions: this.activeExecutions.size,
        hardwareStats: {
          cpu: Math.random() * 100,
          memory: Math.random() * 100,
          disk: Math.random() * 100,
        },
      },
    };

    this.ws.send(JSON.stringify(heartbeat));
  }
}

// CLI entry point
if (require.main === module) {
  const configPath = process.argv[2] || './agent-config.json';

  try {
    const configText = require('fs').readFileSync(configPath, 'utf8');
    const config = JSON.parse(configText);

    const agent = new UITraceAgent(config);

    // Handle graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down agent...');
      await agent.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\nShutting down agent...');
      await agent.stop();
      process.exit(0);
    });

    agent.start().catch((error) => {
      console.error('Failed to start agent:', error);
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to load config:', error);
    process.exit(1);
  }
}