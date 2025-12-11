import { z } from 'zod';

// Common schemas
export const uuidSchema = z.string().uuid('Invalid UUID format');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

export const sortBySchema = z.object({
  field: z.string(),
  direction: z.enum(['asc', 'desc']).default('desc'),
});

export const dateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// Project schemas
export const createProjectSchema = z.object({
  name: z.string().min(2).max(100),
  icon: z.string().max(50).optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

export const projectParamsSchema = z.object({
  projectId: uuidSchema,
});

// Version schemas
export const createVersionSchema = z.object({
  projectId: uuidSchema,
  name: z.string().regex(/^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/, 'Invalid semantic version'),
  status: z.enum(['DRAFT', 'ACTIVE', 'ARCHIVED']).default('DRAFT'),
  releaseDate: z.string().datetime().optional(),
});

export const updateVersionSchema = createVersionSchema.partial().omit({ projectId: true });

export const versionParamsSchema = z.object({
  projectId: uuidSchema,
  versionId: uuidSchema,
});

// Module schemas
export const createModuleSchema = z.object({
  versionId: uuidSchema,
  name: z.string().min(2).max(100),
  description: z.string().max(500).optional(),
  inheritedFrom: uuidSchema().optional(),
});

export const updateModuleSchema = createModuleSchema.partial().omit({ versionId: true, inheritedFrom: true });

export const moduleParamsSchema = z.object({
  moduleId: uuidSchema,
});

// Script schemas
export const selectorSchema = z.object({
  type: z.enum(['id', 'css', 'xpath', 'text']),
  value: z.string().min(1),
  priority: z.number().int().min(1),
});

export const scriptStepSchema = z.object({
  id: z.number().int().min(1),
  name: z.string().min(1),
  action: z.enum(['navigate', 'click', 'type', 'assert_text', 'screenshot', 'wait']),
  value: z.string().optional(),
  selectors: z.array(selectorSchema).min(1),
  expectedValue: z.string().optional(),
  timeout: z.number().int().min(1000).max(60000).optional(),
});

export const createScriptSchema = z.object({
  moduleId: uuidSchema,
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  priority: z.enum(['P0', 'P1', 'P2']).default('P1'),
  steps: z.array(scriptStepSchema).min(1),
});

export const updateScriptSchema = createScriptSchema.partial().omit({ moduleId: true });

export const scriptParamsSchema = z.object({
  scriptId: uuidSchema,
});

export const runScriptSchema = z.object({
  environment: z.string().min(1).max(100),
  triggeredBy: z.string().min(1).max(100),
  nodeId: uuidSchema().optional(),
});

// Execution schemas
export const executionParamsSchema = z.object({
  executionId: uuidSchema,
});

export const listExecutionsSchema = z.object({
  scriptId: uuidSchema().optional(),
  status: z.enum(['PENDING', 'RUNNING', 'PASS', 'FAIL', 'SKIP', 'TIMEOUT']).optional(),
  ...paginationSchema.shape,
  ...dateRangeSchema.shape,
});

// Server Node schemas
export const browserCapabilitySchema = z.object({
  name: z.enum(['chrome', 'firefox', 'safari', 'edge']),
  version: z.string(),
  platform: z.enum(['windows', 'macos', 'linux']),
});

export const hardwareStatsSchema = z.object({
  cpu: z.number().min(0).max(100),
  memory: z.number().min(0).max(100),
  disk: z.number().min(0).max(100),
});

export const registerNodeSchema = z.object({
  name: z.string().min(1).max(100),
  ip: z.string().ip(),
  os: z.string().min(1).max(50),
  browsers: z.array(browserCapabilitySchema).min(1),
  hardwareStats: hardwareStatsSchema.optional(),
});

export const nodeParamsSchema = z.object({
  nodeId: uuidSchema,
});

export const updateNodeSchema = registerNodeSchema.partial();

// Baseline schemas
export const createBaselineSchema = z.object({
  scriptId: uuidSchema,
  stepId: z.number().int().min(1),
  environment: z.string().min(1).max(100),
  s3Key: z.string().min(1),
  approvedBy: z.string().min(1).max(100),
});

export const baselineParamsSchema = z.object({
  baselineId: uuidSchema,
});

export const approveBaselineSchema = z.object({
  approved: z.boolean(),
  approvedBy: z.string().min(1).max(100),
});

// Analytics schemas
export const analyticsQuerySchema = z.object({
  projectId: uuidSchema().optional(),
  versionId: uuidSchema().optional(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
});

// Response schemas
export const apiResponseSchema = z.object({
  success: z.boolean(),
  data: z.any().optional(),
  error: z.string().optional(),
  message: z.string().optional(),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  }).optional(),
});

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'error']),
  timestamp: z.string().datetime(),
  uptime: z.number(),
  environment: z.string(),
  version: z.string().optional(),
  database: z.object({
    status: z.enum(['connected', 'disconnected']),
    latency: z.number().optional(),
  }),
  redis: z.object({
    status: z.enum(['connected', 'disconnected']),
    latency: z.number().optional(),
  }),
  s3: z.object({
    status: z.enum(['connected', 'disconnected']),
    buckets: z.array(z.string()).optional(),
  }),
});

// Query parameter schemas
export const searchQuerySchema = z.object({
  q: z.string().optional(),
  ...paginationSchema.shape,
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// WebSocket message schemas
export const websocketMessageSchema = z.object({
  type: z.string(),
  data: z.any(),
  timestamp: z.string().datetime(),
  correlationId: z.string().optional(),
});

export const executionUpdateSchema = websocketMessageSchema.extend({
  type: z.literal('execution_update'),
  data: z.object({
    executionId: uuidSchema,
    status: z.enum(['PENDING', 'RUNNING', 'PASS', 'FAIL', 'SKIP', 'TIMEOUT']),
    progress: z.number().min(0).max(100),
    stepIndex: z.number().int().min(0).optional(),
    message: z.string().optional(),
  }),
});

export const logMessageSchema = websocketMessageSchema.extend({
  type: z.literal('log'),
  data: z.object({
    executionId: uuidSchema,
    level: z.enum(['DEBUG', 'INFO', 'WARN', 'ERROR']),
    message: z.string(),
    stepId: z.number().int().optional(),
  }),
});

export const nodeStatusSchema = websocketMessageSchema.extend({
  type: z.literal('node_status'),
  data: z.object({
    nodeId: uuidSchema,
    status: z.enum(['ONLINE', 'OFFLINE', 'BUSY', 'MAINTENANCE']),
    lastHeartbeat: z.string().datetime(),
  }),
});

// Export all schemas for easy import
export const schemas = {
  // Common
  uuid: uuidSchema,
  pagination: paginationSchema,
  sortBy: sortBySchema,
  dateRange: dateRangeSchema,

  // Projects
  createProject: createProjectSchema,
  updateProject: updateProjectSchema,
  projectParams: projectParamsSchema,

  // Versions
  createVersion: createVersionSchema,
  updateVersion: updateVersionSchema,
  versionParams: versionParamsSchema,

  // Modules
  createModule: createModuleSchema,
  updateModule: updateModuleSchema,
  moduleParams: moduleParamsSchema,

  // Scripts
  selector: selectorSchema,
  scriptStep: scriptStepSchema,
  createScript: createScriptSchema,
  updateScript: updateScriptSchema,
  scriptParams: scriptParamsSchema,
  runScript: runScriptSchema,

  // Executions
  executionParams: executionParamsSchema,
  listExecutions: listExecutionsSchema,

  // Server Nodes
  browserCapability: browserCapabilitySchema,
  hardwareStats: hardwareStatsSchema,
  registerNode: registerNodeSchema,
  nodeParams: nodeParamsSchema,
  updateNode: updateNodeSchema,

  // Baselines
  createBaseline: createBaselineSchema,
  baselineParams: baselineParamsSchema,
  approveBaseline: approveBaselineSchema,

  // Analytics
  analyticsQuery: analyticsQuerySchema,

  // Responses
  apiResponse: apiResponseSchema,
  healthResponse: healthResponseSchema,

  // Queries
  searchQuery: searchQuerySchema,

  // WebSocket
  websocketMessage: websocketMessageSchema,
  executionUpdate: executionUpdateSchema,
  logMessage: logMessageSchema,
  nodeStatus: nodeStatusSchema,
};