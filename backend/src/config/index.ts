import { z } from 'zod';
import pino from 'pino';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  HOST: z.string().default('0.0.0.0'),

  // Database
  DATABASE_URL: z.string(),

  // Redis
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.string().transform(Number).default('6379'),
  REDIS_PASSWORD: z.string().optional(),
  REDIS_DB: z.string().transform(Number).default('0'),

  // JWT
  JWT_SECRET: z.string(),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // S3/MinIO
  S3_ENDPOINT: z.string(),
  S3_PORT: z.string().transform(Number).default('9000'),
  S3_ACCESS_KEY: z.string(),
  S3_SECRET_KEY: z.string(),
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: z.string().default('uitrace-screenshots'),
  S3_BASELINE_BUCKET: z.string().default('uitrace-baselines'),
  S3_DIFF_BUCKET: z.string().default('uitrace-diffs'),
  S3_TRACE_BUCKET: z.string().default('uitrace-traces'),
  S3_USE_SSL: z.string().transform(val => val === 'true').default('false'),

  // WebSocket
  WS_PORT: z.string().transform(Number).default('3001'),
  WS_CORS_ORIGIN: z.string().default('http://localhost:3000'),

  // Logging
  LOG_LEVEL: z.string().default('info'),
  LOG_PRETTY: z.string().transform(val => val === 'true').default('true'),

  // Rate limiting
  RATE_LIMIT_MAX: z.string().transform(Number).default('100'),
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('60000'),

  // CORS
  CORS_ORIGIN: z.string().default('http://localhost:3000').transform(val => {
    // Support multiple origins separated by comma
    const origins = val.split(',').map(o => o.trim()).filter(Boolean);
    return origins.length === 1 ? origins[0] : origins;
  }),
  CORS_CREDENTIALS: z.string().transform(val => val === 'true').default('true'),

  // Sentry (optional)
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().default('development'),

  // BullMQ
  QUEUE_CONCURRENCY: z.string().transform(Number).default('10'),
  QUEUE_MAX_JOBS_PER_WORKER: z.string().transform(Number).default('5'),

  // Playwright
  PLAYWRIGHT_BROWSERS_PATH: z.string().default('0'),
  PLAYWRIGHT_TIMEOUT: z.string().transform(Number).default('30000'),
  PLAYWRIGHT_HEADLESS: z.string().transform(val => val === 'true').default('true'),

  // Visual Diff
  VISUAL_DIFF_TOLERANCE: z.string().transform(Number).default('0.1'),
  VISUAL_DIFF_THRESHOLD: z.string().transform(Number).default('5.0'),

  // Data Retention
  EXECUTION_RETENTION_DAYS: z.string().transform(Number).default('90'),
  LOG_RETENTION_DAYS: z.string().transform(Number).default('30'),
  VISUAL_DIFF_RETENTION_DAYS: z.string().transform(Number).default('90'),
  TRACE_RETENTION_DAYS: z.string().transform(Number).default('7'),

  // Health Check
  HEALTH_CHECK_INTERVAL: z.string().transform(Number).default('30000'),
});

const env = envSchema.parse(process.env);

export const config = {
  app: {
    env: env.NODE_ENV,
    port: env.PORT,
    host: env.HOST,
  },
  database: {
    url: env.DATABASE_URL,
  },
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
    db: env.REDIS_DB,
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },
  s3: {
    endpoint: env.S3_ENDPOINT,
    port: env.S3_PORT,
    accessKey: env.S3_ACCESS_KEY,
    secretKey: env.S3_SECRET_KEY,
    region: env.S3_REGION,
    bucket: env.S3_BUCKET,
    baselineBucket: env.S3_BASELINE_BUCKET,
    diffBucket: env.S3_DIFF_BUCKET,
    traceBucket: env.S3_TRACE_BUCKET,
    useSSL: env.S3_USE_SSL,
  },
  websocket: {
    port: env.WS_PORT,
    corsOrigin: env.WS_CORS_ORIGIN,
  },
  logging: {
    level: env.LOG_LEVEL as pino.Level,
    pretty: env.LOG_PRETTY,
  },
  rateLimit: {
    max: env.RATE_LIMIT_MAX,
    window: env.RATE_LIMIT_WINDOW,
  },
  cors: {
    origin: env.CORS_ORIGIN,
    credentials: env.CORS_CREDENTIALS,
  },
  sentry: {
    dsn: env.SENTRY_DSN,
    environment: env.SENTRY_ENVIRONMENT,
  },
  queue: {
    concurrency: env.QUEUE_CONCURRENCY,
    maxJobsPerWorker: env.QUEUE_MAX_JOBS_PER_WORKER,
  },
  playwright: {
    browsersPath: env.PLAYWRIGHT_BROWSERS_PATH,
    timeout: env.PLAYWRIGHT_TIMEOUT,
    headless: env.PLAYWRIGHT_HEADLESS,
  },
  visualDiff: {
    tolerance: env.VISUAL_DIFF_TOLERANCE,
    threshold: env.VISUAL_DIFF_THRESHOLD,
  },
  retention: {
    executionDays: env.EXECUTION_RETENTION_DAYS,
    logDays: env.LOG_RETENTION_DAYS,
    visualDiffDays: env.VISUAL_DIFF_RETENTION_DAYS,
    traceDays: env.TRACE_RETENTION_DAYS,
  },
  healthCheck: {
    interval: env.HEALTH_CHECK_INTERVAL,
  },
} as const;