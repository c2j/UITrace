import { FastifyRequest, FastifyReply } from 'fastify';
import { ZodSchema, ZodError } from 'zod';
import { badRequest } from './errorHandler';

export const validateRequest = (schema: {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Validate body if schema provided
      if (schema.body) {
        const validatedBody = schema.body.parse(request.body);
        request.body = validatedBody;
      }

      // Validate params if schema provided
      if (schema.params) {
        const validatedParams = schema.params.parse(request.params);
        request.params = validatedParams;
      }

      // Validate query if schema provided
      if (schema.query) {
        const validatedQuery = schema.query.parse(request.query);
        request.query = validatedQuery;
      }
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
        }));

        throw badRequest('Validation failed', validationErrors);
      }
      throw error;
    }
  };
};

// Validation middleware for common operations
export const validateUuid = (paramName: string = 'id') => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const id = (request.params as any)[paramName];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!id || typeof id !== 'string' || !uuidRegex.test(id)) {
      throw badRequest(`Invalid ${paramName}: must be a valid UUID`);
    }
  };
};

export const validatePagination = () => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;

    // Validate page
    if (query.page !== undefined) {
      const page = parseInt(query.page);
      if (isNaN(page) || page < 1) {
        throw badRequest('Invalid page: must be a positive integer');
      }
      query.page = page;
    }

    // Validate limit
    if (query.limit !== undefined) {
      const limit = parseInt(query.limit);
      if (isNaN(limit) || limit < 1 || limit > 100) {
        throw badRequest('Invalid limit: must be between 1 and 100');
      }
      query.limit = limit;
    }

    request.query = query;
  };
};

export const validateDateRange = () => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;

    // Validate startDate
    if (query.startDate !== undefined) {
      const startDate = new Date(query.startDate);
      if (isNaN(startDate.getTime())) {
        throw badRequest('Invalid startDate: must be a valid date');
      }
      if (startDate > new Date()) {
        throw badRequest('Invalid startDate: cannot be in the future');
      }
      query.startDate = startDate.toISOString();
    }

    // Validate endDate
    if (query.endDate !== undefined) {
      const endDate = new Date(query.endDate);
      if (isNaN(endDate.getTime())) {
        throw badRequest('Invalid endDate: must be a valid date');
      }
      if (endDate < new Date('2020-01-01')) {
        throw badRequest('Invalid endDate: cannot be before 2020-01-01');
      }
      query.endDate = endDate.toISOString();
    }

    // Validate date range
    if (query.startDate && query.endDate) {
      if (new Date(query.startDate) > new Date(query.endDate)) {
        throw badRequest('Invalid date range: startDate must be before endDate');
      }
    }

    request.query = query;
  };
};

export const validateSortOptions = (allowedFields: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;

    if (query.sortBy && !allowedFields.includes(query.sortBy)) {
      throw badRequest(
        `Invalid sortBy: must be one of ${allowedFields.join(', ')}`
      );
    }

    if (query.sortOrder && !['asc', 'desc'].includes(query.sortOrder)) {
      throw badRequest('Invalid sortOrder: must be either "asc" or "desc"');
    }

    // Set defaults
    if (!query.sortOrder) {
      query.sortOrder = 'desc';
    }

    request.query = query;
  };
};

export const validateSearchQuery = (minLength: number = 2, maxLength: number = 100) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as any;

    if (!query.q) {
      throw badRequest('Search query is required');
    }

    if (typeof query.q !== 'string') {
      throw badRequest('Search query must be a string');
    }

    if (query.q.length < minLength) {
      throw badRequest(`Search query must be at least ${minLength} characters`);
    }

    if (query.q.length > maxLength) {
      throw badRequest(`Search query must not exceed ${maxLength} characters`);
    }

    // Trim whitespace
    query.q = query.q.trim();

    if (query.q.length === 0) {
      throw badRequest('Search query cannot be empty');
    }
  };
};

// Sanitization helpers
export const sanitizeString = (value: any): string | null => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    return String(value);
  }

  return value.trim();
};

export const sanitizeArray = (value: any): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(item => item !== null && item !== undefined)
    .map(item => String(item).trim())
    .filter(item => item.length > 0);
};

export const validateEnum = (value: any, allowedValues: string[], fieldName: string) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (!allowedValues.includes(value)) {
    throw badRequest(
      `Invalid ${fieldName}: must be one of ${allowedValues.join(', ')}`
    );
  }

  return value;
};