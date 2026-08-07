import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import type { ValidCacheKey } from './cache-keys.factory';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor() {
    this.client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');

    this.client.on('connect', () => this.logger.log('Redis connected'));
    this.client.on('close', () => this.logger.warn('Redis disconnected'));
    this.client.on('error', (err: Error) =>
      this.logger.error(`Redis error: ${err.message}`, err.stack),
    );
  }

  public async get<T>(key: ValidCacheKey): Promise<T | null> {
    try {
      const data = await this.client.get(key);

      return data ? (JSON.parse(data) as T) : null;
    } catch {
      this.logger.warn(`Cache read failed for ${key}`);
      return null;
    }
  }

  public async set(
    key: ValidCacheKey,
    value: unknown,
    ttlSeconds?: number,
  ): Promise<void> {
    try {
      const stringified = JSON.stringify(value);

      if (ttlSeconds !== undefined) {
        await this.client.set(key, stringified, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, stringified);
      }
    } catch {
      this.logger.warn(`Cache write failed for ${key}`);
    }
  }

  public async delete(key: ValidCacheKey): Promise<void> {
    try {
      await this.client.del(key);
    } catch {
      this.logger.warn(`Cache invalidation failed for ${key}`);
    }
  }

  public async onModuleDestroy(): Promise<void> {
    await this.client.quit();
    this.logger.log('Redis connection closed');
  }
}
