import pino from 'pino';
import { config } from '@/config';

export const logger = pino({
  level: config.logging.level,
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  ...(config.logging.pretty && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        levelFirst: true,
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  }),
});

export const createLoggerWithCorrelation = (correlationId: string) => {
  return logger.child({ correlationId });
};

export const correlationIdMiddleware = async (request: any, reply: any) => {
  const correlationId = request.headers['x-correlation-id'] as string ||
    Math.random().toString(36).substring(7);

  request.correlationId = correlationId;
  reply.header('x-correlation-id', correlationId);

  const childLogger = logger.child({ correlationId });
  request.log = childLogger;
};