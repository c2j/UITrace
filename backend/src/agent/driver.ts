import { Page, Browser, BrowserContext, LaunchOptions } from 'playwright';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { s3Client } from '../libs/s3.js';
import { WebSocketService } from '../libs/websocket.js';
import { ExecutionService } from '../modules/execution/service.js';
import { Script, ScriptStep } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

export interface ExecuteScriptRequest {
  executionId: string;
  scriptId: string;
  environment: 'chromium' | 'firefox' | 'webkit';
  nodeId?: string;
}

export interface StepResult {
  stepId: number;
  status: 'PASS' | 'FAIL';
  duration: number;
  error?: string;
  screenshotKey?: string;
  actualValue?: any;
}

export interface ExecutionResult {
  executionId: string;
  status: 'PASS' | 'FAIL' | 'TIMEOUT';
  duration: number;
  steps: StepResult[];
  screenshots: string[];
  error?: string;
}

export class PlaywrightDriver {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private wsService: WebSocketService;
  private executionService: ExecutionService;
  private screenshots: string[] = [];
  // Track last update time for throttling (executionId -> timestamp)
  private lastUpdateMap: Map<string, number> = new Map();
  // Minimum interval between updates (in ms)
  private readonly UPDATE_THROTTLE_MS = 100;

  constructor() {
    // Get WebSocket service instance (will be injected)
    this.wsService = {} as WebSocketService;
    this.executionService = {} as ExecutionService;
  }

  setServices(wsService: WebSocketService, executionService: ExecutionService): void {
    this.wsService = wsService;
    this.executionService = executionService;
  }

  async executeScript(request: ExecuteScriptRequest): Promise<ExecutionResult> {
    const startTime = Date.now();
    const stepResults: StepResult[] = [];
    this.screenshots = [];

    try {
      // Get script details
      const script = await this.getScript(request.scriptId);
      if (!script) {
        throw new Error(`Script not found: ${request.scriptId}`);
      }

      // Initialize browser
      await this.initializeBrowser(request.environment);

      // Update execution status to RUNNING
      await this.updateExecutionStatus(request.executionId, 'RUNNING', 0, 'Initializing browser');

      // Execute steps
      for (let i = 0; i < script.steps.length; i++) {
        const step = script.steps[i];
        const stepStartTime = Date.now();
        const progress = Math.round(((i + 1) / script.steps.length) * 100);

        try {
          // Update progress
          await this.updateExecutionStatus(
            request.executionId,
            'RUNNING',
            progress,
            `Executing step ${i + 1}: ${step.action}`,
            i
          );

          // Log step start
          await this.logStep(request.executionId, i, 'INFO', `Starting step: ${step.action}`);

          // Execute step
          const result = await this.executeStep(step, i);
          stepResults.push(result);

          if (result.status === 'FAIL') {
            // Take screenshot on failure
            const screenshotKey = await this.takeScreenshot(
              request.executionId,
              `step_${i}_failed`,
              true
            );
            result.screenshotKey = screenshotKey;

            // Log error
            await this.logStep(request.executionId, i, 'ERROR', result.error || 'Step failed');

            // Stop execution on first failure
            break;
          }

          // Log success
          await this.logStep(
            request.executionId,
            i,
            'INFO',
            `Step completed successfully: ${step.action}`
          );
        } catch (error) {
          const duration = Date.now() - stepStartTime;
          const screenshotKey = await this.takeScreenshot(
            request.executionId,
            `step_${i}_error`,
            true
          );

          stepResults.push({
            stepId: i,
            status: 'FAIL',
            duration,
            error: error.message,
            screenshotKey,
          });

          await this.logStep(request.executionId, i, 'ERROR', `Step error: ${error.message}`);
          break;
        }
      }

      // Calculate final status
      const allPassed = stepResults.every(r => r.status === 'PASS');
      const finalStatus = allPassed ? 'PASS' : 'FAIL';
      const duration = Date.now() - startTime;

      // Create final screenshot
      await this.takeScreenshot(request.executionId, 'final', false);

      // Cleanup
      await this.cleanup();

      const result: ExecutionResult = {
        executionId: request.executionId,
        status: finalStatus,
        duration,
        steps: stepResults,
        screenshots: this.screenshots,
      };

      // Update execution with results
      await this.updateExecutionStatus(
        request.executionId,
        finalStatus,
        100,
        finalStatus === 'PASS' ? 'All steps completed successfully' : 'One or more steps failed'
      );

      // Update execution with step results
      await this.executionService.updateExecution(request.executionId, {
        status: finalStatus,
        logs: stepResults
          .filter(r => r.error)
          .map(r => ({
            level: 'ERROR' as const,
            message: r.error!,
            stepId: r.stepId,
          })),
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Take screenshot on error
      try {
        await this.takeScreenshot(request.executionId, 'error', true);
      } catch (screenshotError) {
        logger.error('Failed to take error screenshot', { error: screenshotError.message });
      }

      await this.cleanup();

      const result: ExecutionResult = {
        executionId: request.executionId,
        status: 'FAIL',
        duration,
        steps: stepResults,
        screenshots: this.screenshots,
        error: error.message,
      };

      await this.updateExecutionStatus(request.executionId, 'FAIL', 0, error.message);

      return result;
    }
  }

  private async initializeBrowser(environment: string): Promise<void> {
    const options: LaunchOptions = {
      headless: config.playwright.headless,
      timeout: config.playwright.timeout,
    };

    switch (environment) {
      case 'chromium':
        this.browser = await require('playwright').chromium.launch(options);
        break;
      case 'firefox':
        this.browser = await require('playwright').firefox.launch(options);
        break;
      case 'webkit':
        this.browser = await require('playwright').webkit.launch(options);
        break;
      default:
        throw new Error(`Unsupported browser: ${environment}`);
    }

    // Create context with viewport
    this.context = await this.browser.newContext({
      viewport: { width: 1920, height: 1080 },
      ignoreHTTPSErrors: true,
    });

    // Create page
    this.page = await this.context.newPage();

    // Set default timeout
    this.page.setDefaultTimeout(config.playwright.timeout);

    logger.info('Browser initialized', { environment, headless: options.headless });
  }

  private async executeStep(step: ScriptStep, stepIndex: number): Promise<StepResult> {
    const startTime = Date.now();

    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    try {
      switch (step.action) {
        case 'navigate':
          await this.page.goto(step.value);
          break;

        case 'click':
          await this.clickElement(step);
          break;

        case 'type':
          await this.typeText(step);
          break;

        case 'assert_text':
          const actualText = await this.getElementText(step);
          return {
            stepId: stepIndex,
            status: actualText === step.expectedValue ? 'PASS' : 'FAIL',
            duration: Date.now() - startTime,
            error: actualText !== step.expectedValue ? `Expected "${step.expectedValue}", got "${actualText}"` : undefined,
            actualValue: actualText,
          };

        case 'screenshot':
          const screenshotKey = await this.takeScreenshot(
            uuidv4(),
            `step_${stepIndex}`,
            false
          );
          return {
            stepId: stepIndex,
            status: 'PASS',
            duration: Date.now() - startTime,
            screenshotKey,
          };

        case 'wait':
          await this.page.waitForTimeout(parseInt(step.value) || 1000);
          break;

        default:
          throw new Error(`Unsupported step action: ${step.action}`);
      }

      return {
        stepId: stepIndex,
        status: 'PASS',
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        stepId: stepIndex,
        status: 'FAIL',
        duration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async clickElement(step: ScriptStep): Promise<void> {
    const selector = this.getSelector(step);
    await this.page.waitForSelector(selector, { state: 'visible' });
    await this.page.click(selector);
  }

  private async typeText(step: ScriptStep): Promise<void> {
    const selector = this.getSelector(step);
    await this.page.waitForSelector(selector, { state: 'visible' });
    await this.page.fill(selector, '');
    await this.page.type(selector, step.value);
  }

  private async getElementText(step: ScriptStep): Promise<string> {
    const selector = this.getSelector(step);
    await this.page.waitForSelector(selector, { state: 'visible' });
    const element = await this.page.$(selector);

    if (!element) {
      throw new Error(`Element not found: ${selector}`);
    }

    return element.textContent() || '';
  }

  private getSelector(step: ScriptStep): string {
    if (!step.selectors || step.selectors.length === 0) {
      throw new Error('No selectors provided for step');
    }

    // Get the highest priority selector (lowest priority number)
    const sortedSelectors = step.selectors.sort((a, b) => a.priority - b.priority);
    const selector = sortedSelectors[0];

    switch (selector.type) {
      case 'css':
        return selector.value;
      case 'id':
        return `#${selector.value}`;
      case 'xpath':
        return selector.value;
      case 'text':
        return `text=${selector.value}`;
      default:
        throw new Error(`Unsupported selector type: ${selector.type}`);
    }
  }

  private async takeScreenshot(executionId: string, name: string, isError: boolean = false): Promise<string> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    const screenshot = await this.page.screenshot({
      type: 'png',
      fullPage: isError,
    });

    const key = `screenshots/${executionId}/${name}.png`;
    await s3Client.uploadScreenshot(key, screenshot);
    this.screenshots.push(key);

    return key;
  }

  private async updateExecutionStatus(
    executionId: string,
    status: string,
    progress: number,
    message: string,
    stepIndex?: number
  ): Promise<void> {
    // Throttle WebSocket updates to prevent flickering
    const now = Date.now();
    const lastUpdate = this.lastUpdateMap.get(executionId) || 0;
    const shouldSendUpdate = now - lastUpdate >= this.UPDATE_THROTTLE_MS;

    // Only emit WebSocket update if enough time has passed
    if (shouldSendUpdate) {
      this.wsService.emitExecutionUpdate(executionId, {
        status,
        progress,
        stepIndex,
        message,
      });
      this.lastUpdateMap.set(executionId, now);
    }

    // Always update database (not throttled)
    await this.executionService.updateExecution(executionId, {
      status: status as any,
      progress,
      message,
    });
  }

  private async logStep(
    executionId: string,
    stepId: number,
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR',
    message: string
  ): Promise<void> {
    // Emit log via WebSocket
    this.wsService.emitLogMessage(executionId, {
      level,
      message,
      stepId,
    });

    // Update in database
    await this.executionService.updateExecution(executionId, {
      logs: [{ level, message, stepId }],
    });
  }

  private async getScript(scriptId: string): Promise<Script | null> {
    // This would typically use the ScriptService
    // For now, we'll use Prisma directly
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();

    try {
      return await prisma.script.findUnique({
        where: { id: scriptId },
      });
    } finally {
      await prisma.$disconnect();
    }
  }

  private async cleanup(): Promise<void> {
    try {
      if (this.context) {
        await this.context.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
    } catch (error) {
      logger.error('Error during cleanup', { error: error.message });
    } finally {
      this.browser = null;
      this.context = null;
      this.page = null;
    }
  }

  // Method to get browser instance for external control
  getBrowser(): Browser | null {
    return this.browser;
  }

  // Method to get page instance for external control
  getPage(): Page | null {
    return this.page;
  }

  // Method to handle timeouts
  async handleTimeout(executionId: string, timeout: number): Promise<void> {
    await this.updateExecutionStatus(executionId, 'TIMEOUT', 0, `Execution timed out after ${timeout}ms`);
    await this.cleanup();
  }
}