import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class RedisService extends Redis implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);

  constructor() {
    super(process.env.REDIS_URL ?? 'redis://localhost:6379');

    this.on('connect', () => this.logger.log('Redis connected'));
    this.on('close', () => this.logger.warn('Redis disconnected'));
    this.on('error', (err: Error) =>
      this.logger.error(`Redis error: ${err.message}`, err.stack),
    );
  }

  public async onModuleDestroy(): Promise<void> {
    await this.quit();
    this.logger.log('Redis connection closed');
  }
}
