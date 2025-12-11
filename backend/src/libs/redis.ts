import Redis from 'ioredis';
import { config } from '@/config';
import { logger } from '@/utils/logger';

class RedisClient {
  private client: Redis;
  private isConnected: boolean = false;

  constructor() {
    this.client = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      db: config.redis.db,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    this.client.on('connect', () => {
      this.isConnected = true;
      logger.info('Redis connected successfully');
    });

    this.client.on('error', (error) => {
      this.isConnected = false;
      logger.error('Redis connection error', { error });
    });

    this.client.on('close', () => {
      this.isConnected = false;
      logger.warn('Redis connection closed');
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis reconnecting...');
    });
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.client.setex(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logger.error('Error setting Redis key', { key, error });
      throw error;
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error('Error getting Redis key', { key, error });
      throw error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error('Error deleting Redis key', { key, error });
      throw error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error('Error checking Redis key existence', { key, error });
      throw error;
    }
  }

  async incr(key: string): Promise<number> {
    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error('Error incrementing Redis key', { key, error });
      throw error;
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    try {
      await this.client.expire(key, ttl);
    } catch (error) {
      logger.error('Error setting Redis key expiration', { key, ttl, error });
      throw error;
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      return await this.client.ttl(key);
    } catch (error) {
      logger.error('Error getting Redis key TTL', { key, error });
      throw error;
    }
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    try {
      await this.client.hset(key, field, value);
    } catch (error) {
      logger.error('Error setting Redis hash field', { key, field, error });
      throw error;
    }
  }

  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await this.client.hget(key, field);
    } catch (error) {
      logger.error('Error getting Redis hash field', { key, field, error });
      throw error;
    }
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await this.client.hgetall(key);
    } catch (error) {
      logger.error('Error getting all Redis hash fields', { key, error });
      throw error;
    }
  }

  async hdel(key: string, field: string): Promise<void> {
    try {
      await this.client.hdel(key, field);
    } catch (error) {
      logger.error('Error deleting Redis hash field', { key, field, error });
      throw error;
    }
  }

  async lpush(key: string, value: string): Promise<number> {
    try {
      return await this.client.lpush(key, value);
    } catch (error) {
      logger.error('Error pushing to Redis list', { key, error });
      throw error;
    }
  }

  async rpop(key: string): Promise<string | null> {
    try {
      return await this.client.rpop(key);
    } catch (error) {
      logger.error('Error popping from Redis list', { key, error });
      throw error;
    }
  }

  async llen(key: string): Promise<number> {
    try {
      return await this.client.llen(key);
    } catch (error) {
      logger.error('Error getting Redis list length', { key, error });
      throw error;
    }
  }

  async flushdb(): Promise<void> {
    try {
      await this.client.flushdb();
      logger.info('Redis database flushed');
    } catch (error) {
      logger.error('Error flushing Redis database', { error });
      throw error;
    }
  }

  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  getClient(): Redis {
    return this.client;
  }
}

export const redisClient = new RedisClient();