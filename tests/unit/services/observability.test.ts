import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ObservabilityService } from '../../../src/services/observability.js';
import type {
  CostEntry,
  FallbackEntry,
  LatencyEntry,
} from '../../../src/services/observability.js';

// Mock Redis client
const mockRedis = {
  zadd: vi.fn(),
  zrange: vi.fn(),
  expire: vi.fn(),
  keys: vi.fn(),
};

// Mock getRedis
vi.mock('../../../src/services/redis.js', () => ({
  getRedis: () => mockRedis,
}));

describe('ObservabilityService', () => {
  let service: ObservabilityService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ObservabilityService();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('recordCost', () => {
    it('should record cost entry in Redis sorted set', async () => {
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const entry: CostEntry = {
        keyId: 'key-123',
        model: 'gpt-4',
        cost: 0.05,
        timestamp: 1700000000000,
      };

      await service.recordCost(entry);

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'obs:cost:key-123:gpt-4',
        entry.timestamp,
        JSON.stringify({ cost: entry.cost, timestamp: entry.timestamp })
      );
      expect(mockRedis.expire).toHaveBeenCalledWith('obs:cost:key-123:gpt-4', expect.any(Number));
    });

    it('should use current timestamp if not provided', async () => {
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const entry = {
        keyId: 'key-456',
        model: 'claude-3',
        cost: 0.1,
      };

      await service.recordCost(entry as CostEntry);

      expect(mockRedis.zadd).toHaveBeenCalled();
      const call = mockRedis.zadd.mock.calls[0];
      // Timestamp should be a number (current time)
      expect(typeof call[1]).toBe('number');
    });
  });

  describe('getCostByKey', () => {
    it('should sum costs for all models under a key', async () => {
      mockRedis.keys.mockResolvedValue(['obs:cost:key-123:gpt-4', 'obs:cost:key-123:claude-3']);
      mockRedis.zrange.mockResolvedValueOnce([
        JSON.stringify({ cost: 0.05, timestamp: 1000 }),
        JSON.stringify({ cost: 0.03, timestamp: 2000 }),
      ]);
      mockRedis.zrange.mockResolvedValueOnce([JSON.stringify({ cost: 0.1, timestamp: 3000 })]);

      const result = await service.getCostByKey('key-123');

      expect(result).toBe(0.18);
      expect(mockRedis.keys).toHaveBeenCalledWith('obs:cost:key-123:*');
    });

    it('should return 0 for non-existent key', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const result = await service.getCostByKey('nonexistent');

      expect(result).toBe(0);
    });
  });

  describe('getCostByModel', () => {
    it('should sum costs for all keys using a model', async () => {
      mockRedis.keys.mockResolvedValue(['obs:cost:key-1:gpt-4', 'obs:cost:key-2:gpt-4']);
      mockRedis.zrange.mockResolvedValueOnce([JSON.stringify({ cost: 0.05, timestamp: 1000 })]);
      mockRedis.zrange.mockResolvedValueOnce([JSON.stringify({ cost: 0.07, timestamp: 2000 })]);

      const result = await service.getCostByModel('gpt-4');

      expect(result).toBeCloseTo(0.12, 2);
      expect(mockRedis.keys).toHaveBeenCalledWith('obs:cost:*:gpt-4');
    });
  });

  describe('getAllCostsByKey', () => {
    it('should return Map of costs grouped by key', async () => {
      mockRedis.keys.mockResolvedValue([
        'obs:cost:key-1:gpt-4',
        'obs:cost:key-1:claude-3',
        'obs:cost:key-2:gpt-4',
      ]);
      mockRedis.zrange.mockResolvedValueOnce([JSON.stringify({ cost: 0.05, timestamp: 1000 })]);
      mockRedis.zrange.mockResolvedValueOnce([JSON.stringify({ cost: 0.1, timestamp: 2000 })]);
      mockRedis.zrange.mockResolvedValueOnce([JSON.stringify({ cost: 0.03, timestamp: 3000 })]);

      const result = await service.getAllCostsByKey();

      expect(result.size).toBe(2);
      expect(result.get('key-1')).toBeCloseTo(0.15, 2);
      expect(result.get('key-2')).toBeCloseTo(0.03, 2);
    });
  });

  describe('getAllCostsByModel', () => {
    it('should return Map of costs grouped by model', async () => {
      mockRedis.keys.mockResolvedValue([
        'obs:cost:key-1:gpt-4',
        'obs:cost:key-2:gpt-4',
        'obs:cost:key-1:claude-3',
      ]);
      mockRedis.zrange.mockResolvedValueOnce([JSON.stringify({ cost: 0.05, timestamp: 1000 })]);
      mockRedis.zrange.mockResolvedValueOnce([JSON.stringify({ cost: 0.03, timestamp: 2000 })]);
      mockRedis.zrange.mockResolvedValueOnce([JSON.stringify({ cost: 0.1, timestamp: 3000 })]);

      const result = await service.getAllCostsByModel();

      expect(result.size).toBe(2);
      expect(result.get('gpt-4')).toBe(0.08);
      expect(result.get('claude-3')).toBe(0.1);
    });
  });

  describe('recordFallback', () => {
    it('should record fallback event in Redis', async () => {
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const entry: FallbackEntry = {
        providerId: 'primary',
        model: 'gpt-4',
        fromProvider: 'fallback-1',
        timestamp: 1700000000000,
      };

      await service.recordFallback(entry);

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'obs:fallback:primary:gpt-4',
        entry.timestamp,
        JSON.stringify({ fromProvider: entry.fromProvider, timestamp: entry.timestamp })
      );
      expect(mockRedis.expire).toHaveBeenCalled();
    });
  });

  describe('getFallbackFrequency', () => {
    it('should count fallbacks by source provider', async () => {
      mockRedis.keys.mockResolvedValue(['obs:fallback:primary:gpt-4']);
      mockRedis.zrange.mockResolvedValue([
        JSON.stringify({ fromProvider: 'fallback-1', timestamp: 1000 }),
        JSON.stringify({ fromProvider: 'fallback-1', timestamp: 2000 }),
        JSON.stringify({ fromProvider: 'fallback-2', timestamp: 3000 }),
      ]);

      const result = await service.getFallbackFrequency('primary');

      expect(result.get('fallback-1')).toBe(2);
      expect(result.get('fallback-2')).toBe(1);
    });

    it('should return empty map for provider with no fallbacks', async () => {
      mockRedis.keys.mockResolvedValue([]);

      const result = await service.getFallbackFrequency('nonexistent');

      expect(result.size).toBe(0);
    });
  });

  describe('getAllFallbackFrequency', () => {
    it('should aggregate fallback counts across all providers', async () => {
      mockRedis.keys.mockResolvedValue([
        'obs:fallback:primary:gpt-4',
        'obs:fallback:secondary:gpt-4',
      ]);
      mockRedis.zrange.mockResolvedValueOnce([
        JSON.stringify({ fromProvider: 'fallback-1', timestamp: 1000 }),
      ]);
      mockRedis.zrange.mockResolvedValueOnce([
        JSON.stringify({ fromProvider: 'fallback-1', timestamp: 2000 }),
        JSON.stringify({ fromProvider: 'fallback-2', timestamp: 3000 }),
      ]);

      const result = await service.getAllFallbackFrequency();

      expect(result.get('fallback-1')).toBe(2);
      expect(result.get('fallback-2')).toBe(1);
    });
  });

  describe('recordLatency', () => {
    it('should record latency with score for percentile calculations', async () => {
      mockRedis.zadd.mockResolvedValue(1);
      mockRedis.expire.mockResolvedValue(1);

      const entry: LatencyEntry = {
        providerId: 'openai',
        model: 'gpt-4',
        latencyMs: 150,
        timestamp: 1700000000000,
      };

      await service.recordLatency(entry);

      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'obs:latency:openai:gpt-4',
        entry.latencyMs,
        JSON.stringify({ latencyMs: entry.latencyMs, timestamp: entry.timestamp })
      );
    });
  });

  describe('getLatencyStats', () => {
    it('should calculate percentile statistics from latency data', async () => {
      // Mock zrange with WITHSCORES returns alternating values and scores
      mockRedis.zrange.mockResolvedValue([
        JSON.stringify({ latencyMs: 100, timestamp: 1 }),
        '100',
        JSON.stringify({ latencyMs: 150, timestamp: 2 }),
        '150',
        JSON.stringify({ latencyMs: 200, timestamp: 3 }),
        '200',
        JSON.stringify({ latencyMs: 250, timestamp: 4 }),
        '250',
        JSON.stringify({ latencyMs: 300, timestamp: 5 }),
        '300',
      ]);

      const result = await service.getLatencyStats('openai', 'gpt-4');

      expect(result.count).toBe(5);
      expect(result.p50).toBe(200); // middle value after sort
      expect(result.p95).toBeDefined();
      expect(result.p99).toBeDefined();
    });

    it('should return zeros for provider/model with no data', async () => {
      mockRedis.zrange.mockResolvedValue([]);

      const result = await service.getLatencyStats('nonexistent', 'unknown');

      expect(result).toEqual({ p50: 0, p95: 0, p99: 0, count: 0 });
    });

    it('should handle single latency entry', async () => {
      mockRedis.zrange.mockResolvedValue([JSON.stringify({ latencyMs: 150, timestamp: 1 }), '150']);

      const result = await service.getLatencyStats('provider', 'model');

      expect(result.count).toBe(1);
      expect(result.p50).toBe(150);
      expect(result.p95).toBe(150);
      expect(result.p99).toBe(150);
    });
  });
});
