// Script-related DTOs and types

export interface ScriptStepDto {
  id: number;
  name: string;
  action: 'navigate' | 'click' | 'type' | 'assert_text' | 'screenshot' | 'wait';
  value?: string;
  selectors: SelectorDto[];
  expectedValue?: string;
  timeout?: number;
}

export interface SelectorDto {
  type: 'id' | 'css' | 'xpath' | 'text';
  value: string;
  priority: number;
}

export interface CreateScriptDto {
  moduleId: string;
  name: string;
  description?: string;
  priority?: 'P0' | 'P1' | 'P2';
  steps: ScriptStepDto[];
}

export interface UpdateScriptDto {
  name?: string;
  description?: string;
  priority?: 'P0' | 'P1' | 'P2';
  steps?: ScriptStepDto[];
}

export interface RunScriptDto {
  environment: string;
  triggeredBy: string;
  nodeId?: string;
}

export interface ScriptStatsDto {
  totalExecutions: number;
  passCount: number;
  failCount: number;
  successRate: number;
  lastExecution?: {
    id: string;
    status: string;
    startTime: string;
  };
}

export interface ScriptSearchResultDto {
  id: string;
  name: string;
  description?: string;
  priority: string;
  lastRunStatus?: string;
  module: {
    name: string;
    version: {
      name: string;
    };
  };
}

export interface ScriptExecutionDto {
  id: string;
  scriptId: string;
  status: string;
  startTime: string;
  endTime?: string;
  durationMs?: number;
  environment: string;
  triggeredBy: string;
  nodeId?: string;
  qualityScore?: number;
}