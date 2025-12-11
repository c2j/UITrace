import { apiClient, ApiResponse, PaginatedResponse, getHeaders } from './api';
import { Execution, ExecutionStep } from './scriptService';

// Extended types for execution responses
export interface ExecutionSummary {
  id: string;
  project: string;
  version: string;
  testCase: string;
  module: string;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'PENDING' | 'RUNNING' | 'TIMEOUT';
  duration: string;
  environment: string;
  triggeredBy: string;
  time: string;
}

export interface ExecutionDetail {
  id: string;
  scriptId: string;
  scriptName: string;
  projectName: string;
  versionName: string;
  moduleName: string;
  status: 'PASS' | 'FAIL' | 'SKIP' | 'PENDING' | 'RUNNING' | 'TIMEOUT';
  startTime: string;
  endTime?: string;
  duration?: number;
  environment: string;
  triggeredBy: string;
  nodeId?: string;
  nodeName?: string;
  qualityScore?: number;
  grade?: string;
  networkRequests?: number;
  consoleErrors?: number;
  steps: ExecutionStep[];
}

export interface TestResultLog {
  id: string;
  executionId: string;
  timestamp: string;
  level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  stepId?: number;
}

export interface VisualDiffData {
  id: string;
  executionId: string;
  stepId: number;
  baselineUrl?: string;
  actualUrl?: string;
  diffUrl?: string;
  diffPercentage?: number;
  tolerance: number;
  approved: boolean;
  hasDiff: boolean;
}

export interface ExecutionMetrics {
  qualityScore: number;
  grade: string;
  networkRequests: number;
  consoleErrors: number;
  totalAssertions: number;
  passedAssertions: number;
  failedAssertions: number;
  skippedAssertions: number;
  coverage?: number;
}

export interface ExecutionStats {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  pending: number;
  running: number;
  averageDuration: number;
  passRate: number;
}

// Execution service
export const executionService = {
  // Get all executions (with filters)
  async getExecutions(params?: {
    project?: string;
    version?: string;
    module?: string;
    script?: string;
    status?: string;
    environment?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<ApiResponse<PaginatedResponse<ExecutionSummary>>> {
    return apiClient.get<PaginatedResponse<ExecutionSummary>>('/executions', params);
  },

  // Get execution details
  async getExecution(executionId: string): Promise<ApiResponse<ExecutionDetail>> {
    return apiClient.get<ExecutionDetail>(`/executions/${executionId}`);
  },

  // Get execution logs
  async getExecutionLogs(
    executionId: string,
    params?: {
      level?: string;
      stepId?: number;
      limit?: number;
    }
  ): Promise<ApiResponse<TestResultLog[]>> {
    return apiClient.get<TestResultLog[]>(`/executions/${executionId}/logs`, params);
  },

  // Get execution metrics
  async getExecutionMetrics(executionId: string): Promise<ApiResponse<ExecutionMetrics>> {
    return apiClient.get<ExecutionMetrics>(`/executions/${executionId}/metrics`);
  },

  // Get visual diffs for an execution
  async getVisualDiffs(executionId: string): Promise<ApiResponse<VisualDiffData[]>> {
    return apiClient.get<VisualDiffData[]>(`/executions/${executionId}/visual-diffs`);
  },

  // Get specific visual diff
  async getVisualDiff(executionId: string, stepId: number): Promise<ApiResponse<VisualDiffData>> {
    return apiClient.get<VisualDiffData>(`/executions/${executionId}/visual-diffs/${stepId}`);
  },

  // Accept visual baseline
  async acceptVisualBaseline(executionId: string, stepId: number): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`/executions/${executionId}/visual-diff/${stepId}/accept`);
  },

  // Reject visual baseline
  async rejectVisualBaseline(executionId: string, stepId: number): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`/executions/${executionId}/visual-diff/${stepId}/reject`);
  },

  // Download execution trace
  async downloadTrace(executionId: string): Promise<Blob> {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
    const response = await fetch(`${baseUrl}/executions/${executionId}/trace`, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to download trace');
    }

    return response.blob();
  },

  // Download execution report
  async downloadReport(executionId: string, format: 'pdf' | 'html' = 'pdf'): Promise<Blob> {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api/v1';
    const response = await fetch(`${baseUrl}/executions/${executionId}/report?format=${format}`, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error('Failed to download report');
    }

    return response.blob();
  },

  // Cancel running execution
  async cancelExecution(executionId: string): Promise<ApiResponse<void>> {
    return apiClient.post<void>(`/executions/${executionId}/cancel`);
  },

  // Retry failed execution
  async retryExecution(executionId: string): Promise<ApiResponse<{ executionId: string }>> {
    return apiClient.post<{ executionId: string }>(`/executions/${executionId}/retry`);
  },

  // Get execution statistics
  async getExecutionStats(params?: {
    projectId?: string;
    versionId?: string;
    moduleId?: string;
    days?: number;
  }): Promise<ApiResponse<ExecutionStats>> {
    return apiClient.get<ExecutionStats>('/executions/stats', params);
  },

  // Get daily execution statistics for charts
  async getDailyStats(params?: {
    projectId?: string;
    days?: number;
  }): Promise<ApiResponse<Array<{ date: string; passed: number; failed: number; skipped: number }>>> {
    return apiClient.get<Array<{ date: string; passed: number; failed: number; skipped: number }>>(
      '/executions/daily-stats',
      params
    );
  },

  // Batch accept/reject visual diffs
  async batchApproveVisualDiffs(
    executionId: string,
    stepIds: number[]
  ): Promise<ApiResponse<{ approved: number; rejected: number }>> {
    return apiClient.post<{ approved: number; rejected: number }>(
      `/executions/${executionId}/visual-diffs/batch`,
      { stepIds, action: 'accept' }
    );
  },
};

// Helper functions for execution display
export const executionUtils = {
  // Format status
  formatStatus(status: string): string {
    switch (status) {
      case 'PENDING':
        return 'Pending';
      case 'RUNNING':
        return 'Running';
      case 'PASS':
        return 'Passed';
      case 'FAIL':
        return 'Failed';
      case 'SKIP':
        return 'Skipped';
      case 'TIMEOUT':
        return 'Timeout';
      default:
        return status;
    }
  },

  // Get status color
  getStatusColor(status: string): string {
    switch (status) {
      case 'PENDING':
        return '#666666';
      case 'RUNNING':
        return '#1890ff';
      case 'PASS':
        return '#52c41a';
      case 'FAIL':
        return '#ff4d4f';
      case 'SKIP':
        return '#faad14';
      case 'TIMEOUT':
        return '#f5222d';
      default:
        return '#666666';
    }
  },

  // Format duration
  formatDuration(duration?: number): string {
    if (!duration) return 'N/A';

    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  },

  // Format relative time
  formatRelativeTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days} day${days > 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    } else {
      return 'Just now';
    }
  },

  // Calculate pass rate
  calculatePassRate(stats: ExecutionStats): number {
    return stats.total > 0 ? Math.round((stats.passed / stats.total) * 100) : 0;
  },

  // Get grade color
  getGradeColor(grade?: string): string {
    switch (grade) {
      case 'A':
        return '#52c41a';
      case 'B':
        return '#faad14';
      case 'C':
        return '#fa8c16';
      case 'D':
        case 'F':
        return '#ff4d4f';
      default:
        return '#666666';
    }
  },

  // Format log level
  formatLogLevel(level: string): string {
    return level.toUpperCase();
  },

  // Get log level color
  getLogLevelColor(level: string): string {
    switch (level) {
      case 'DEBUG':
        return '#666666';
      case 'INFO':
        return '#1890ff';
      case 'WARN':
        return '#faad14';
      case 'ERROR':
        return '#ff4d4f';
      default:
        return '#666666';
    }
  },
};