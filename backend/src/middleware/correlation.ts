import { FastifyRequest, FastifyReply } from 'fastify';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/utils/logger';

export interface CorrelationContext {
  correlationId: string;
  requestId?: string;
  userId?: string;
  executionId?: string;
  sessionId?: string;
  parentSpanId?: string;
  traceId?: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    correlationContext: CorrelationContext;
  }
}

/**
 * Middleware to add correlation ID tracking to all requests
 */
export async function correlationMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Get correlation ID from header or generate new one
  const correlationId = request.headers['x-correlation-id'] as string || uuidv4();

  // Get request ID from header or generate new one
  const requestId = request.headers['x-request-id'] as string || uuidv4();

  // Get trace ID for distributed tracing
  const traceId = request.headers['x-trace-id'] as string || correlationId;

  // Get parent span ID if this is part of a distributed trace
  const parentSpanId = request.headers['x-parent-span-id'] as string;

  // Get user ID from JWT token if available
  const userId = (request.user as any)?.sub;

  // Get execution ID from route params or headers
  const executionId = (request.params as any)?.executionId || request.headers['x-execution-id'] as string;

  // Get session ID from header or cookie
  const sessionId = request.headers['x-session-id'] as string ||
                    request.cookies?.sessionId as string;

  // Create correlation context
  const correlationContext: CorrelationContext = {
    correlationId,
    requestId,
    userId,
    executionId,
    sessionId,
    parentSpanId,
    traceId,
  };

  // Attach to request object
  request.correlationContext = correlationContext;

  // Add correlation headers to response
  reply.header('X-Correlation-ID', correlationId);
  reply.header('X-Request-ID', requestId);
  reply.header('X-Trace-ID', traceId);

  // Add correlation context to logger
  request.log = request.log.child({
    correlationId,
    requestId,
    userId,
    executionId,
    sessionId,
    parentSpanId,
    traceId,
  });

  // Log request start
  request.log.info('Request started', {
    method: request.method,
    url: request.url,
    userAgent: request.headers['user-agent'],
    ip: request.ip,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Function to create a span for tracking operations
 */
export function createSpan(
  name: string,
  correlationContext: CorrelationContext,
  parentSpanId?: string
): {
  spanId: string;
  traceId: string;
  start: () => void;
  end: (error?: Error) => void;
  setTag: (key: string, value: any) => void;
} {
  const spanId = uuidv4();
  const traceId = correlationContext.traceId || correlationContext.correlationId;
  let startTime: number | null = null;
  let endTime: number | null = null;
  let error: Error | null = null;
  const tags: Record<string, any> = {};

  return {
    spanId,
    traceId,
    start: () => {
      startTime = Date.now();
      logger.debug('Span started', {
        spanName: name,
        spanId,
        traceId,
        parentSpanId: parentSpanId || correlationContext.parentSpanId,
        correlationId: correlationContext.correlationId,
      });
    },
    end: (err?: Error) => {
      endTime = Date.now();
      error = err;

      const duration = startTime ? endTime - startTime : 0;

      if (error) {
        logger.error('Span ended with error', {
          spanName: name,
          spanId,
          traceId,
          duration,
          error: error.message,
          stack: error.stack,
          tags,
          correlationId: correlationContext.correlationId,
        });
      } else {
        logger.debug('Span ended', {
          spanName: name,
          spanId,
          traceId,
          duration,
          tags,
          correlationId: correlationContext.correlationId,
        });
      }
    },
    setTag: (key: string, value: any) => {
      tags[key] = value;
    },
  };
}

/**
 * Function to propagate correlation context to downstream services
 */
export function createHeadersFromContext(
  correlationContext: CorrelationContext
): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Correlation-ID': correlationContext.correlationId,
    'X-Request-ID': correlationContext.requestId || '',
    'X-Trace-ID': correlationContext.traceId || correlationContext.correlationId,
  };

  if (correlationContext.parentSpanId) {
    headers['X-Parent-Span-ID'] = correlationContext.parentSpanId;
  }

  if (correlationContext.userId) {
    headers['X-User-ID'] = correlationContext.userId;
  }

  if (correlationContext.executionId) {
    headers['X-Execution-ID'] = correlationContext.executionId;
  }

  if (correlationContext.sessionId) {
    headers['X-Session-ID'] = correlationContext.sessionId;
  }

  return headers;
}

/**
 * Middleware to add correlation context to Winston logger
 */
export function loggerCorrelation() {
  return {
    write: (message: string) => {
      const log = JSON.parse(message);
      if (log.correlationId) {
        // Add correlation context to all logs
        log.correlation = {
          correlationId: log.correlationId,
          traceId: log.traceId,
          spanId: log.spanId,
        };
      }
      process.stdout.write(JSON.stringify(log) + '\n');
    },
  };
}

/**
 * Function to extract correlation context from incoming headers
 */
export function extractContextFromHeaders(
  headers: Record<string, string | string[] | undefined>
): Partial<CorrelationContext> {
  const context: Partial<CorrelationContext> = {};

  if (headers['x-correlation-id']) {
    context.correlationId = Array.isArray(headers['x-correlation-id'])
      ? headers['x-correlation-id'][0]
      : headers['x-correlation-id'];
  }

  if (headers['x-request-id']) {
    context.requestId = Array.isArray(headers['x-request-id'])
      ? headers['x-request-id'][0]
      : headers['x-request-id'];
  }

  if (headers['x-trace-id']) {
    context.traceId = Array.isArray(headers['x-trace-id'])
      ? headers['x-trace-id'][0]
      : headers['x-trace-id'];
  }

  if (headers['x-parent-span-id']) {
    context.parentSpanId = Array.isArray(headers['x-parent-span-id'])
      ? headers['x-parent-span-id'][0]
      : headers['x-parent-span-id'];
  }

  if (headers['x-user-id']) {
    context.userId = Array.isArray(headers['x-user-id'])
      ? headers['x-user-id'][0]
      : headers['x-user-id'];
  }

  if (headers['x-execution-id']) {
    context.executionId = Array.isArray(headers['x-execution-id'])
      ? headers['x-execution-id'][0]
      : headers['x-execution-id'];
  }

  if (headers['x-session-id']) {
    context.sessionId = Array.isArray(headers['x-session-id'])
      ? headers['x-session-id'][0]
      : headers['x-session-id'];
  }

  return context;
}

/**
 * Decorator to add correlation context to async functions
 */
export function withCorrelation<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  getCorrelationContext: () => CorrelationContext
): T {
  return (async (...args: any[]) => {
    const context = getCorrelationContext();
    const span = createSpan(fn.name, context);

    try {
      span.start();
      span.setTag('args', args.map(arg => typeof arg === 'object' ? '[Object]' : arg));

      const result = await fn(...args);

      span.setTag('success', true);
      span.end();

      return result;
    } catch (error) {
      span.setTag('success', false);
      span.setTag('error', error.message);
      span.end(error);

      throw error;
    }
  }) as T;
}

/**
 * Fastify plugin to register correlation ID middleware
 */
export async function correlationPlugin(fastify: any, options: any) {
  // Add correlation middleware
  fastify.addHook('preHandler', correlationMiddleware);

  // Add decorator for creating spans
  fastify.decorate('createSpan', createSpan);

  // Add decorator for creating headers
  fastify.decorate('createHeaders', createHeadersFromContext);

  // Add request completion hook
  fastify.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const duration = reply.getResponseTime();
    request.log.info('Request completed', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      duration,
      contentLength: reply.getHeader('content-length'),
    });
  });

  // Add error hook
  fastify.addHook('onError', async (request: FastifyRequest, reply: FastifyReply, error: Error) => {
    request.log.error('Request error', {
      method: request.method,
      url: request.url,
      statusCode: reply.statusCode,
      error: error.message,
      stack: error.stack,
    });
  });
}