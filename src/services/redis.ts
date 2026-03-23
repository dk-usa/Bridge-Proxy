import Redis from 'ioredis';
import { createHash } from 'crypto';

let redis: Redis | null = null;

export function getRedis(): Redis | null {
  return redis;
}

export function initRedis(url?: string): Redis {
  if (redis) {
    return redis;
  }

  redis = new Redis(url || process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });

  redis.on('error', (err) => {
    console.error('Redis connection error:', err.message);
  });

  redis.on('connect', () => {
    console.log('Redis connected');
  });

  return redis;
}

export function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

export function isRedisAvailable(): boolean {
  return redis !== null && redis.status === 'ready';
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
  }
}
