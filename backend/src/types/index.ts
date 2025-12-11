// Global type definitions

declare module 'fastify' {
  interface FastifyInstance {
    prisma: import('@prisma/client').PrismaClient;
  }

  interface FastifyRequest {
    correlationId?: string;
  }
}

// Common utility types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: PaginationInfo;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Search and filter types
export interface SearchParams {
  q: string;
  page?: number;
  limit?: number;
}

export interface DateRangeFilter {
  startDate?: string;
  endDate?: string;
}

export interface SortOptions {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Environment and execution types
export interface Environment {
  id: string;
  name: string;
  description?: string;
  browser: string;
  version: string;
  platform: 'windows' | 'macos' | 'linux';
  screenWidth: number;
  screenHeight: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExecutionEnvironment {
  browser: string;
  version: string;
  platform: string;
  screenWidth?: number;
  screenHeight?: number;
}

// File upload types
export interface UploadedFile {
  filename: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface S3UploadResult {
  key: string;
  url: string;
  etag: string;
}

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: string;
  correlationId?: string;
}

export interface ExecutionUpdateMessage extends WebSocketMessage {
  type: 'execution_update';
  data: {
    executionId: string;
    status: string;
    progress: number;
    stepIndex?: number;
    message?: string;
  };
}

export interface LogMessage extends WebSocketMessage {
  type: 'log';
  data: {
    executionId: string;
    level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
    message: string;
    stepId?: number;
  };
}

export interface NodeStatusMessage extends WebSocketMessage {
  type: 'node_status';
  data: {
    nodeId: string;
    status: string;
    lastHeartbeat: string;
  };
}

// Task and job types
export interface JobData {
  id: string;
  type: string;
  data: any;
  options?: {
    attempts?: number;
    delay?: number;
    priority?: number;
  };
}

export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
}

// Metrics and analytics types
export interface ExecutionMetrics {
  totalExecutions: number;
  passCount: number;
  failCount: number;
  skipCount: number;
  averageDuration: number;
  successRate: number;
}

export interface TimeSeriesDataPoint {
  timestamp: string;
  value: number;
}

export interface AnalyticsData {
  executionsOverTime: TimeSeriesDataPoint[];
  successRateOverTime: TimeSeriesDataPoint[];
  averageDurationOverTime: TimeSeriesDataPoint[];
  topFailingScripts: Array<{
    scriptId: string;
    scriptName: string;
    failureCount: number;
  }>;
}

// Health check types
export interface HealthCheckResult {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  environment: string;
  version?: string;
  database: {
    status: 'connected' | 'disconnected';
    latency?: number;
  };
  redis: {
    status: 'connected' | 'disconnected';
    latency?: number;
  };
  s3: {
    status: 'connected' | 'disconnected';
    buckets?: string[];
  };
}

// Error types
export interface ValidationError {
  field: string;
  message: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  code?: string;
  details?: ValidationError[];
  correlationId?: string;
}