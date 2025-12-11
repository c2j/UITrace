import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { logger } from '@/utils/logger';

export interface ApiError extends FastifyError {
  statusCode?: number;
  code?: string;
  details?: any;
}

export class AppError extends Error implements ApiError {
  statusCode: number;
  code: string;
  details?: any;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500, code?: string, details?: any) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code || 'INTERNAL_ERROR';
    this.details = details;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = async (
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) => {
  // Log error with correlation ID if available
  const correlationId = (request as any).correlationId || 'none';
  const loggerWithError = logger.child({ correlationId });

  // Handle validation errors
  if (error instanceof ZodError) {
    loggerWithError.warn('Validation error', {
      errors: error.errors,
      path: request.url,
      method: request.method,
    });

    reply.status(400).send({
      error: 'Validation Error',
      message: 'Invalid request data',
      details: error.errors,
      code: 'VALIDATION_ERROR',
      correlationId,
    });
    return;
  }

  // Handle JWT errors
  if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing authorization header',
      code: 'JWT_MISSING',
      correlationId,
    });
    return;
  }

  if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Token expired',
      code: 'JWT_EXPIRED',
      correlationId,
    });
    return;
  }

  if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid token',
      code: 'JWT_INVALID',
      correlationId,
    });
    return;
  }

  // Handle Prisma errors
  if (error.code === 'P2002') {
    reply.status(409).send({
      error: 'Conflict',
      message: 'Resource already exists',
      code: 'DUPLICATE_RESOURCE',
      correlationId,
    });
    return;
  }

  if (error.code === 'P2025') {
    reply.status(404).send({
      error: 'Not Found',
      message: 'Resource not found',
      code: 'RESOURCE_NOT_FOUND',
      correlationId,
    });
    return;
  }

  // Handle custom application errors
  if (error instanceof AppError) {
    loggerWithError.warn('Application error', {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
      path: request.url,
      method: request.method,
    });

    reply.status(error.statusCode).send({
      error: error.name,
      message: error.message,
      code: error.code,
      details: error.details,
      correlationId,
    });
    return;
  }

  // Handle rate limit errors
  if (error.statusCode === 429) {
    reply.status(429).send({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded',
      code: 'RATE_LIMIT_EXCEEDED',
      correlationId,
    });
    return;
  }

  // Log unexpected errors
  loggerWithError.error('Unexpected error', {
    error: error.message,
    stack: error.stack,
    path: request.url,
    method: request.method,
  });

  // Send generic error response
  reply.status(500).send({
    error: 'Internal Server Error',
    message: 'An unexpected error occurred',
    code: 'INTERNAL_ERROR',
    correlationId,
  });
};

export const createError = (
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any
): AppError => {
  return new AppError(message, statusCode, code, details);
};

export const badRequest = (message: string, details?: any): AppError => {
  return createError(message, 400, 'BAD_REQUEST', details);
};

export const unauthorized = (message: string = 'Unauthorized'): AppError => {
  return createError(message, 401, 'UNAUTHORIZED');
};

export const forbidden = (message: string = 'Forbidden'): AppError => {
  return createError(message, 403, 'FORBIDDEN');
};

export const notFound = (message: string = 'Resource not found'): AppError => {
  return createError(message, 404, 'NOT_FOUND');
};

export const conflict = (message: string = 'Resource conflict'): AppError => {
  return createError(message, 409, 'CONFLICT');
};