import { Type } from '@sinclair/typebox';
import { ExecutionStatus } from '@prisma/client';

// Common schemas
export const EnvironmentSchema = Type.Union([
  Type.Literal('chromium'),
  Type.Literal('firefox'),
  Type.Literal('webkit'),
]);

export const ExecutionStatusSchema = Type.Union([
  Type.Literal('PENDING'),
  Type.Literal('RUNNING'),
  Type.Literal('PASS'),
  Type.Literal('FAIL'),
  Type.Literal('TIMEOUT'),
  Type.Literal('SKIP'),
]);

export const LogLevelSchema = Type.Union([
  Type.Literal('DEBUG'),
  Type.Literal('INFO'),
  Type.Literal('WARN'),
  Type.Literal('ERROR'),
]);

// Execution creation
export const CreateExecutionSchema = {
  body: Type.Object({
    environment: EnvironmentSchema,
    triggeredBy: Type.String({ minLength: 1 }),
    nodeId: Type.Optional(Type.String({ format: 'uuid' })),
  }),
  params: Type.Object({
    scriptId: Type.String({ format: 'uuid' }),
  }),
};

// Get single execution
export const GetExecutionSchema = {
  params: Type.Object({
    executionId: Type.String({ format: 'uuid' }),
  }),
  querystring: Type.Object({
    include: Type.Optional(Type.String()),
  }),
};

// Update execution
export const UpdateExecutionSchema = {
  params: Type.Object({
    executionId: Type.String({ format: 'uuid' }),
  }),
  body: Type.Object({
    status: Type.Optional(ExecutionStatusSchema),
    progress: Type.Optional(Type.Integer({ minimum: 0, maximum: 100 })),
    stepIndex: Type.Optional(Type.Integer({ minimum: 0 })),
    message: Type.Optional(Type.String()),
    error: Type.Optional(Type.String()),
    logs: Type.Optional(Type.Array(
      Type.Object({
        level: LogLevelSchema,
        message: Type.String(),
        stepId: Type.Optional(Type.Integer()),
      })
    )),
  }),
};

// List executions
export const GetExecutionsSchema = {
  querystring: Type.Object({
    scriptId: Type.Optional(Type.String({ format: 'uuid' })),
    status: Type.Optional(ExecutionStatusSchema),
    startDate: Type.Optional(Type.String({ format: 'date-time' })),
    endDate: Type.Optional(Type.String({ format: 'date-time' })),
    page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 100, default: 10 })),
  }),
};

// Stop execution
export const StopExecutionSchema = {
  params: Type.Object({
    executionId: Type.String({ format: 'uuid' }),
  }),
  body: Type.Object({
    triggeredBy: Type.String({ minLength: 1 }),
  }),
};

// Retry execution
export const RetryExecutionSchema = {
  params: Type.Object({
    executionId: Type.String({ format: 'uuid' }),
  }),
  body: Type.Object({
    triggeredBy: Type.String({ minLength: 1 }),
  }),
};

// Get execution logs
export const GetExecutionLogsSchema = {
  params: Type.Object({
    executionId: Type.String({ format: 'uuid' }),
  }),
  querystring: Type.Object({
    page: Type.Optional(Type.Integer({ minimum: 1, default: 1 })),
    limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000, default: 100 })),
    level: Type.Optional(LogLevelSchema),
    stepId: Type.Optional(Type.Integer({ minimum: 0 })),
  }),
};

// Visual diff approval
export const ApproveDiffSchema = {
  params: Type.Object({
    diffId: Type.String({ format: 'uuid' }),
  }),
  body: Type.Object({
    approved: Type.Boolean(),
    reason: Type.Optional(Type.String()),
  }),
};

// WebSocket message schemas
export const WebSocketMessageSchema = {
  type: Type.String(),
  data: Type.Unknown(),
  timestamp: Type.String({ format: 'date-time' }),
};

export const ExecutionUpdateMessageSchema = {
  ...WebSocketMessageSchema,
  type: Type.Literal('execution_update'),
  data: Type.Object({
    executionId: Type.String({ format: 'uuid' }),
    status: ExecutionStatusSchema,
    progress: Type.Integer({ minimum: 0, maximum: 100 }),
    stepIndex: Type.Integer({ minimum: 0 }),
    message: Type.String(),
    error: Type.Optional(Type.String()),
  }),
};

export const LogMessageSchema = {
  ...WebSocketMessageSchema,
  type: Type.Literal('log'),
  data: Type.Object({
    executionId: Type.String({ format: 'uuid' }),
    level: LogLevelSchema,
    message: Type.String(),
    stepId: Type.Optional(Type.Integer()),
  }),
};

export const NodeStatusMessageSchema = {
  ...WebSocketMessageSchema,
  type: Type.Literal('node_status'),
  data: Type.Object({
    nodeId: Type.String({ format: 'uuid' }),
    status: Type.Union([
      Type.Literal('ONLINE'),
      Type.Literal('OFFLINE'),
      Type.Literal('BUSY'),
      Type.Literal('MAINTENANCE'),
    ]),
    lastHeartbeat: Type.String({ format: 'date-time' }),
  }),
};

// Execution step schemas
export const ScriptStepTypeSchema = Type.Union([
  Type.Literal('navigate'),
  Type.Literal('click'),
  Type.Literal('type'),
  Type.Literal('assert_text'),
  Type.Literal('screenshot'),
  Type.Literal('wait'),
]);

export const ScriptStepSchema = Type.Object({
  id: Type.Optional(Type.String()),
  type: ScriptStepTypeSchema,
  url: Type.Optional(Type.String()),
  cssSelector: Type.Optional(Type.String()),
  xpath: Type.Optional(Type.String()),
  id: Type.Optional(Type.String()),
  name: Type.Optional(Type.String()),
  dataTestId: Type.Optional(Type.String()),
  value: Type.Optional(Type.String()),
  timeout: Type.Optional(Type.Integer({ minimum: 0 })),
  waitForSelector: Type.Optional(Type.Boolean()),
});

// Visual diff schemas
export const VisualDiffOptionsSchema = Type.Object({
  tolerance: Type.Optional(Type.Number({ minimum: 0, maximum: 1, default: 0.1 })),
  threshold: Type.Optional(Type.Number({ minimum: 0, maximum: 1, default: 0.05 })),
  includeAntiAliasing: Type.Optional(Type.Boolean({ default: true })),
});

export const CreateVisualDiffSchema = {
  body: Type.Object({
    executionId: Type.String({ format: 'uuid' }),
    stepId: Type.Integer({ minimum: 0 }),
    baselineKey: Type.String(),
    actualKey: Type.String(),
    options: Type.Optional(VisualDiffOptionsSchema),
  }),
};

export const BatchApproveDiffsSchema = {
  body: Type.Object({
    diffIds: Type.Array(Type.String({ format: 'uuid' }), { minItems: 1 }),
    approved: Type.Boolean(),
    reason: Type.Optional(Type.String()),
  }),
};

// Agent registration
export const AgentRegistrationSchema = {
  body: Type.Object({
    nodeId: Type.String({ format: 'uuid' }),
    name: Type.String({ minLength: 1 }),
    version: Type.String(),
    capabilities: Type.Object({
      browsers: Type.Array(EnvironmentSchema),
      maxConcurrentExecutions: Type.Integer({ minimum: 1 }),
      features: Type.Optional(Type.Array(Type.String())),
    }),
    metadata: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  }),
};

// Execution environment
export const ExecutionEnvironmentSchema = {
  body: Type.Object({
    browser: EnvironmentSchema,
    version: Type.String(),
    platform: Type.String(),
    viewport: Type.Optional(Type.Object({
      width: Type.Integer({ minimum: 1 }),
      height: Type.Integer({ minimum: 1 }),
    })),
    timezone: Type.Optional(Type.String()),
    locale: Type.Optional(Type.String()),
    userAgent: Type.Optional(Type.String()),
    extraHeaders: Type.Optional(Type.Record(Type.String(), Type.String())),
  }),
};

// Export all schemas for easy import
export const ExecutionSchemas = {
  CreateExecutionSchema,
  GetExecutionSchema,
  UpdateExecutionSchema,
  GetExecutionsSchema,
  StopExecutionSchema,
  RetryExecutionSchema,
  GetExecutionLogsSchema,
  ApproveDiffSchema,
  CreateVisualDiffSchema,
  BatchApproveDiffsSchema,
  AgentRegistrationSchema,
  ExecutionEnvironmentSchema,
  WebSocket: {
    ExecutionUpdateMessageSchema,
    LogMessageSchema,
    NodeStatusMessageSchema,
  },
};