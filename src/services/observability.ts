import { getRedis } from './redis.js';

function getRedisClient() {
  const client = getRedis();
  if (!client) {
    throw new Error('Redis not available');
  }
  return client;
}

export interface CostEntry {
  keyId: string;
  model: string;
  cost: number;
  timestamp: number;
}

export interface FallbackEntry {
  providerId: string;
  model: string;
  fromProvider: string;
  timestamp: number;
}

export interface LatencyEntry {
  providerId: string;
  model: string;
  latencyMs: number;
  timestamp: number;
}

export interface CostBy {
  keyId?: string;
  model?: string;
}

export class ObservabilityService {
  private readonly COST_KEY_PREFIX = 'obs:cost:';
  private readonly FALLBACK_KEY_PREFIX = 'obs:fallback:';
  private readonly LATENCY_KEY_PREFIX = 'obs:latency:';
  private readonly COST_TTL = 86400 * 30;
  private readonly FALLBACK_TTL = 86400 * 7;
  private readonly LATENCY_TTL = 86400 * 7;

  async recordCost(entry: CostEntry): Promise<void> {
    const redis = getRedisClient();
    const key = `${this.COST_KEY_PREFIX}${entry.keyId}:${entry.model}`;
    const timestamp = entry.timestamp || Date.now();
    await redis.zadd(key, timestamp, JSON.stringify({ cost: entry.cost, timestamp }));
    await redis.expire(key, this.COST_TTL);
  }

  async getCostByKey(keyId: string): Promise<number> {
    const redis = getRedisClient();
    const key = `${this.COST_KEY_PREFIX}${keyId}:*`;
    const keys = await redis.keys(key);
    let total = 0;
    for (const k of keys) {
      const entries = await redis.zrange(k, 0, -1);
      for (const entry of entries) {
        const parsed = JSON.parse(entry);
        total += parsed.cost;
      }
    }
    return total;
  }

  async getCostByModel(model: string): Promise<number> {
    const redis = getRedisClient();
    const key = `${this.COST_KEY_PREFIX}*:${model}`;
    const keys = await redis.keys(key);
    let total = 0;
    for (const k of keys) {
      const entries = await redis.zrange(k, 0, -1);
      for (const entry of entries) {
        const parsed = JSON.parse(entry);
        total += parsed.cost;
      }
    }
    return total;
  }

  async getAllCostsByKey(): Promise<Map<string, number>> {
    const redis = getRedisClient();
    const keys = await redis.keys(`${this.COST_KEY_PREFIX}*`);
    const costsByKey = new Map<string, number>();
    for (const key of keys) {
      const match = key.match(/obs:cost:([^:]+):/);
      if (match) {
        const keyId = match[1];
        const entries = await redis.zrange(key, 0, -1);
        let total = 0;
        for (const entry of entries) {
          const parsed = JSON.parse(entry);
          total += parsed.cost;
        }
        costsByKey.set(keyId, (costsByKey.get(keyId) || 0) + total);
      }
    }
    return costsByKey;
  }

  async getAllCostsByModel(): Promise<Map<string, number>> {
    const redis = getRedisClient();
    const keys = await redis.keys(`${this.COST_KEY_PREFIX}*`);
    const costsByModel = new Map<string, number>();
    for (const key of keys) {
      const match = key.match(/obs:cost:[^:]+:(.+)$/);
      if (match) {
        const model = match[1];
        const entries = await redis.zrange(key, 0, -1);
        let total = 0;
        for (const entry of entries) {
          const parsed = JSON.parse(entry);
          total += parsed.cost;
        }
        costsByModel.set(model, (costsByModel.get(model) || 0) + total);
      }
    }
    return costsByModel;
  }

  async recordFallback(entry: FallbackEntry): Promise<void> {
    const redis = getRedisClient();
    const key = `${this.FALLBACK_KEY_PREFIX}${entry.providerId}:${entry.model}`;
    const timestamp = entry.timestamp || Date.now();
    await redis.zadd(
      key,
      timestamp,
      JSON.stringify({ fromProvider: entry.fromProvider, timestamp })
    );
    await redis.expire(key, this.FALLBACK_TTL);
  }

  async getFallbackFrequency(providerId: string): Promise<Map<string, number>> {
    const redis = getRedisClient();
    const key = `${this.FALLBACK_KEY_PREFIX}${providerId}:*`;
    const keys = await redis.keys(key);
    const frequency = new Map<string, number>();
    for (const k of keys) {
      const entries = await redis.zrange(k, 0, -1);
      for (const entry of entries) {
        const parsed = JSON.parse(entry);
        const from = parsed.fromProvider;
        frequency.set(from, (frequency.get(from) || 0) + 1);
      }
    }
    return frequency;
  }

  async getAllFallbackFrequency(): Promise<Map<string, number>> {
    const redis = getRedisClient();
    const keys = await redis.keys(`${this.FALLBACK_KEY_PREFIX}*`);
    const frequency = new Map<string, number>();
    for (const key of keys) {
      const entries = await redis.zrange(key, 0, -1);
      for (const entry of entries) {
        const parsed = JSON.parse(entry);
        const from = parsed.fromProvider;
        frequency.set(from, (frequency.get(from) || 0) + 1);
      }
    }
    return frequency;
  }

  async recordLatency(entry: LatencyEntry): Promise<void> {
    const redis = getRedisClient();
    const key = `${this.LATENCY_KEY_PREFIX}${entry.providerId}:${entry.model}`;
    const timestamp = entry.timestamp || Date.now();
    await redis.zadd(
      key,
      entry.latencyMs,
      JSON.stringify({ latencyMs: entry.latencyMs, timestamp })
    );
    await redis.expire(key, this.LATENCY_TTL);
  }

  async getLatencyStats(
    providerId: string,
    model: string
  ): Promise<{
    p50: number;
    p95: number;
    p99: number;
    count: number;
  }> {
    const redis = getRedisClient();
    const key = `${this.LATENCY_KEY_PREFIX}${providerId}:${model}`;
    const entries = await redis.zrange(key, 0, -1, 'WITHSCORES');
    const latencies: number[] = [];
    for (let i = 0; i < entries.length; i += 2) {
      latencies.push(parseFloat(entries[i + 1]));
    }
    if (latencies.length === 0) {
      return { p50: 0, p95: 0, p99: 0, count: 0 };
    }
    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)];
    const p95 = latencies[Math.floor(latencies.length * 0.95)];
    const p99 = latencies[Math.floor(latencies.length * 0.99)];
    return { p50, p95, p99, count: latencies.length };
  }
}

export const observabilityService = new ObservabilityService();
