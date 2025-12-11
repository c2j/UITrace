import { apiClient, ApiResponse, PaginatedResponse } from './api';
import { Script, ScriptStep, Locator } from '../types';

// Extended types for API requests
export interface CreateScriptRequest {
  name: string;
  moduleId: string;
  description?: string;
  priority?: 'P0' | 'P1' | 'P2';
  steps: ScriptStep[];
  tags?: string[];
}

export interface UpdateScriptRequest {
  name?: string;
  description?: string;
  priority?: 'P0' | 'P1' | 'P2';
  steps?: ScriptStep[];
  tags?: string[];
  lastModifiedBy?: string;
}

export interface ScriptRunRequest {
  environment?: string;
  nodeId?: string;
  triggeredBy?: string;
}

export interface CreateStepRequest {
  id: number;
  name: string;
  action: 'navigate' | 'click' | 'type' | 'assert_text' | 'screenshot' | 'wait' | 'hover';
  value?: string;
  expectedValue?: string;
  timeout?: number;
  selectors?: Locator[];
}

// Script service
export const scriptService = {
  // Get all scripts (with optional filters)
  async getScripts(params?: {
    projectId?: string;
    versionId?: string;
    moduleId?: string;
    priority?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<Script[]>> {
    return apiClient.get<Script[]>('/scripts', params);
  },

  // Get script by ID
  async getScript(scriptId: string): Promise<ApiResponse<Script>> {
    return apiClient.get<Script>(`/scripts/${scriptId}`);
  },

  // Create new script
  async createScript(data: CreateScriptRequest): Promise<ApiResponse<Script>> {
    return apiClient.post<Script>('/scripts', data);
  },

  // Update script
  async updateScript(scriptId: string, data: UpdateScriptRequest): Promise<ApiResponse<Script>> {
    return apiClient.put<Script>(`/scripts/${scriptId}`, data);
  },

  // Delete script
  async deleteScript(scriptId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/scripts/${scriptId}`);
  },

  // Duplicate script
  async duplicateScript(scriptId: string, newName?: string): Promise<ApiResponse<Script>> {
    return apiClient.post<Script>(`/scripts/${scriptId}/duplicate`, { name: newName });
  },

  // Run script
  async runScript(scriptId: string, options?: ScriptRunRequest): Promise<ApiResponse<{ executionId: string }>> {
    return apiClient.post<{ executionId: string }>(`/scripts/${scriptId}/run`, options);
  },

  // Run script with environment
  async runScriptInEnvironment(
    scriptId: string,
    environment: string,
    nodeId?: string
  ): Promise<ApiResponse<{ executionId: string }>> {
    return apiClient.post<{ executionId: string }>(`/scripts/${scriptId}/run`, {
      environment,
      nodeId,
      triggeredBy: 'user',
    });
  },

  // Get script execution history
  async getScriptExecutions(
    scriptId: string,
    params?: {
      limit?: number;
      offset?: number;
      status?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<ApiResponse<PaginatedResponse>> {
    return apiClient.get<PaginatedResponse>(`/scripts/${scriptId}/executions`, params);
  },

  // Get modules in a project version
  async getModules(params?: {
    projectId?: string;
    versionId?: string;
  }): Promise<ApiResponse<ModuleNode[]>> {
    return apiClient.get<ModuleNode[]>('/modules', params);
  },

  // Create module
  async createModule(data: {
    versionId: string;
    name: string;
    description?: string;
    inheritedFrom?: string;
  }): Promise<ApiResponse<ModuleNode>> {
    return apiClient.post<ModuleNode>('/modules', data);
  },

  // Update module
  async updateModule(
    moduleId: string,
    data: {
      name?: string;
      description?: string;
    }
  ): Promise<ApiResponse<ModuleNode>> {
    return apiClient.put<ModuleNode>(`/modules/${moduleId}`, data);
  },

  // Delete module
  async deleteModule(moduleId: string): Promise<ApiResponse<void>> {
    return apiClient.delete<void>(`/modules/${moduleId}`);
  },

  // Import scripts from file
  async importScripts(file: File, moduleId: string): Promise<ApiResponse<Script[]>> {
    return apiClient.upload<Script[]>(`/modules/${moduleId}/scripts/import`, file);
  },

  // Export scripts
  async exportScripts(params: {
    moduleIds?: string[];
    scriptIds?: string[];
    format?: 'json' | 'yaml' | 'csv';
  }): Promise<ApiResponse<{ downloadUrl: string }>> {
    return apiClient.post<{ downloadUrl: string }>('/scripts/export', params);
  },
};

// Helper functions for script editing
export const scriptUtils = {
  // Create a new step
  createNewStep(order: number): CreateStepRequest {
    return {
      id: order,
      name: `Step ${order}`,
      action: 'click',
      timeout: 30000,
      selectors: [],
    };
  },

  // Validate step
  validateStep(step: CreateStepRequest): { valid: boolean; error?: string } {
    if (!step.name || step.name.trim() === '') {
      return { valid: false, error: 'Step name is required' };
    }

    if (!step.action) {
      return { valid: false, error: 'Action is required' };
    }

    if (step.action === 'navigate' && !step.value) {
      return { valid: false, error: 'URL is required for navigate action' };
    }

    if (['click', 'type', 'assert_text'].includes(step.action) && (!step.selectors || step.selectors.length === 0)) {
      return { valid: false, error: 'At least one selector is required for this action' };
    }

    return { valid: true };
  },

  // Validate script
  validateScript(script: CreateScriptRequest | UpdateScriptRequest): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!script.name || script.name.trim() === '') {
      errors.push('Script name is required');
    }

    if (!script.steps || script.steps.length === 0) {
      errors.push('Script must have at least one step');
    } else {
      script.steps.forEach((step, index) => {
        const stepValidation = scriptUtils.validateStep(step as CreateStepRequest);
        if (!stepValidation.valid) {
          errors.push(`Step ${index + 1}: ${stepValidation.error}`);
        }
      });
    }

    return { valid: errors.length === 0, errors };
  },

  // Format action for display
  formatAction(action: string): string {
    switch (action) {
      case 'navigate':
        return 'Navigate';
      case 'click':
        return 'Click';
      case 'type':
        return 'Type';
      case 'assert_text':
        return 'Assert Text';
      case 'screenshot':
        return 'Screenshot';
      case 'wait':
        return 'Wait';
      case 'hover':
        return 'Hover';
      default:
        return action;
    }
  },

  // Format priority for display
  formatPriority(priority: string): string {
    switch (priority) {
      case 'P0':
        return 'Critical';
      case 'P1':
        return 'High';
      case 'P2':
        return 'Medium';
      default:
        return priority;
    }
  },

  // Get priority color
  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'P0':
        return '#ff4d4f';
      case 'P1':
        return '#faad14';
      case 'P2':
        return '#52c41a';
      default:
        return '#666666';
    }
  },
};

// Types for script execution (for use in execution service)
export interface ExecutionStep {
  id: number;
  name: string;
  action: string;
  status: 'PENDING' | 'RUNNING' | 'PASS' | 'FAIL' | 'SKIP';
  duration?: number;
  error?: string;
  screenshot?: string;
}

export interface Execution {
  id: string;
  scriptId: string;
  status: 'PENDING' | 'RUNNING' | 'PASS' | 'FAIL' | 'SKIP' | 'TIMEOUT';
  startTime: string;
  endTime?: string;
  duration?: number;
  environment: string;
  triggeredBy: string;
  nodeId?: string;
  qualityScore?: number;
  steps?: ExecutionStep[];
}