import { getRedis, hashKey, isRedisAvailable } from '../redis.js';

export interface RateLimitConfig {
  max: number;
  windowMs: number;
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs?: number;
}

export interface TokenBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  max: 100,
  windowMs: 60000,
  keyPrefix: 'ratelimit',
};

export class RateLimiter {
  private config: RateLimitConfig;

  constructor(config: Partial<RateLimitConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async checkLimit(identifier: string, limit?: number): Promise<RateLimitResult> {
    const max = limit || this.config.max;
    const redis = getRedis();

    if (!redis || !isRedisAvailable()) {
      return { allowed: true, remaining: max - 1, resetAt: Date.now() + this.config.windowMs };
    }

    const key = `${this.config.keyPrefix}:${hashKey(identifier)}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    const multi = redis.multi();
    multi.zremrangebyscore(key, 0, windowStart);
    multi.zcard(key);
    multi.zadd(key, now, `${now}-${Math.random()}`);
    multi.pexpire(key, this.config.windowMs);

    const results = await multi.exec();
    const count = (results?.[1]?.[1] as number) || 0;

    if (count >= max) {
      const oldest = await redis.zrange(key, 0, 0, 'WITHSCORES');
      const resetAt =
        oldest.length >= 2 ? Number(oldest[1]) + this.config.windowMs : now + this.config.windowMs;

      return {
        allowed: false,
        remaining: 0,
        resetAt,
        retryAfterMs: Math.max(0, resetAt - now),
      };
    }

    return {
      allowed: true,
      remaining: max - count - 1,
      resetAt: now + this.config.windowMs,
    };
  }

  async tokenBucket(
    identifier: string,
    cost: number = 1,
    limit?: number
  ): Promise<RateLimitResult> {
    const max = limit || this.config.max;
    const redis = getRedis();

    if (!redis || !isRedisAvailable()) {
      return { allowed: true, remaining: max - cost, resetAt: Date.now() + this.config.windowMs };
    }

    const key = `${this.config.keyPrefix}:bucket:${hashKey(identifier)}`;
    const now = Date.now();
    const refillRate = max / this.config.windowMs;

    const bucketStr = await redis.get(key);
    let bucket: TokenBucket;

    if (bucketStr) {
      bucket = JSON.parse(bucketStr);
      const elapsed = now - bucket.lastRefill;
      const tokensToAdd = elapsed * refillRate;
      bucket.tokens = Math.min(max, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    } else {
      bucket = {
        tokens: max,
        lastRefill: now,
        maxTokens: max,
        refillRate,
      };
    }

    if (bucket.tokens >= cost) {
      bucket.tokens -= cost;
      await redis.setex(key, Math.ceil(this.config.windowMs / 1000), JSON.stringify(bucket));

      return {
        allowed: true,
        remaining: Math.floor(bucket.tokens),
        resetAt: now + this.config.windowMs,
      };
    }

    const timeToRefill = Math.ceil((cost - bucket.tokens) / refillRate);

    return {
      allowed: false,
      remaining: 0,
      resetAt: now + timeToRefill,
      retryAfterMs: timeToRefill,
    };
  }

  async resetLimit(identifier: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;

    const key = `${this.config.keyPrefix}:${hashKey(identifier)}`;
    await redis.del(key);
  }

  async getUsage(identifier: string): Promise<number> {
    const redis = getRedis();
    if (!redis || !isRedisAvailable()) return 0;

    const key = `${this.config.keyPrefix}:${hashKey(identifier)}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    await redis.zremrangebyscore(key, 0, windowStart);
    return redis.zcard(key);
  }
}

export const rateLimiter = new RateLimiter();
