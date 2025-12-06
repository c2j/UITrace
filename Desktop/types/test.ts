// Shared types for TestScript and TestStep
// These are used across the application for consistency

export interface TestStep {
  stepId: number
  name: string
  action: 'navigate' | 'click' | 'type' | 'assert_text' | 'assert_url' | 'screenshot' | 'wait'
  selectors: ElementSelector[]
  value?: string
  expectedValue?: string
  timeoutSeconds: number
  screenshot: boolean
}

export interface ElementSelector {
  selectorType: 'id' | 'css' | 'xpath' | 'name' | 'data_attribute'
  value: string
  priority: number // 1-5, lower is higher priority
}

export interface TestScript {
  id: string
  name: string
  description?: string
  version: number
  steps: TestStep[]
  createdAt: string
  updatedAt: string
}

export interface ScriptExecution {
  executionId: string
  scriptId: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  startedAt: string
  completedAt?: string
  totalDurationMs?: number
  totalSteps: number
  successfulSteps: number
  failedSteps: number
}
