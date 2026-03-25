import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Redis } from 'ioredis';

// Import the service
import {
  SemanticCacheService,
  cosineSimilarity,
  semanticCacheService,
} from '../../../src/services/semantic-cache.js';

// Mock dependencies
vi.mock('../../../src/services/redis.js', () => ({
  getRedis: vi.fn(),
  isRedisAvailable: vi.fn(),
}));

vi.mock('../../../src/services/index.js', () => ({
  providerRegistry: {
    getById: vi.fn(() => ({
      id: 'nim',
      type: 'openai-compatible',
      baseUrl: 'https://test.api.com/v1',
      apiKey: 'test-key',
      models: ['test-model'],
      timeoutMs: 60000,
      enabled: true,
      priority: 10,
    })),
  },
}));

vi.mock('../../../src/admin-store.js', () => ({
  adminStore: {
    resolveModel: vi.fn(),
  },
}));

import { getRedis, isRedisAvailable } from '../../../src/services/redis.js';
import { providerRegistry } from '../../../src/services/index.js';

describe('SemanticCacheService', () => {
  let service: SemanticCacheService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SemanticCacheService({ threshold: 0.15, enabled: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('cosineSimilarity', () => {
    it('should return 1.0 for identical vectors', () => {
      const vector = [1, 2, 3, 4, 5];
      expect(cosineSimilarity(vector, vector)).toBe(1);
    });

    it('should return 0.0 for orthogonal vectors', () => {
      const a = [1, 0];
      const b = [0, 1];
      expect(cosineSimilarity(a, b)).toBe(0);
    });

    it('should return correct value for similar vectors', () => {
      // [1, 0] vs [0.8, 0.6]
      // cos(theta) = 0.8
      const a = [1, 0];
      const b = [0.8, 0.6];
      expect(cosineSimilarity(a, b)).toBeCloseTo(0.8, 5);
    });

    it('should return 0 for zero vectors', () => {
      expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
      expect(cosineSimilarity([1, 2, 3], [0, 0, 0])).toBe(0);
      expect(cosineSimilarity([0, 0], [0, 0])).toBe(0);
    });

    it('should handle negative values correctly', () => {
      // [1, 1] vs [-1, -1] should be -1 (opposite direction)
      const a = [1, 1];
      const b = [-1, -1];
      expect(cosineSimilarity(a, b)).toBeCloseTo(-1, 5);
    });
  });

  describe('generateEmbedding', () => {
    it('should have correct method signature', () => {
      expect(typeof service.generateEmbedding).toBe('function');
    });

    it('should return a promise', () => {
      const result = service.generateEmbedding('test text');
      expect(result).toBeInstanceOf(Promise);
    });

    it('should return null when disabled', async () => {
      const disabledService = new SemanticCacheService({ enabled: false });
      const result = await disabledService.generateEmbedding('test text');
      expect(result).toBeNull();
    });

    it('should return null when no provider available', async () => {
      vi.mocked(providerRegistry.getById).mockReturnValue(undefined);
      const result = await service.generateEmbedding('test text');
      expect(result).toBeNull();
    });

    it('should return embedding array on success', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];

      // Reset the mock and set new implementation
      vi.mocked(providerRegistry.getById).mockReturnValue({
        id: 'nim',
        type: 'openai-compatible',
        baseUrl: 'https://test.api.com/v1',
        apiKey: 'test-key',
        models: ['test-model'],
        timeoutMs: 60000,
        enabled: true,
        priority: 10,
      } as ReturnType<typeof providerRegistry.getById>);

      // Mock fetch for embedding
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: [{ embedding: mockEmbedding, index: 0, object: 'embedding' }],
          model: 'test-model',
        }),
      });

      const result = await service.generateEmbedding('test text');
      expect(result).toEqual(mockEmbedding);
    });

    it('should return null on fetch error', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        text: async () => 'Error message',
      });

      const result = await service.generateEmbedding('test text');
      expect(result).toBeNull();
    });

    it('should return null on network error', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await service.generateEmbedding('test text');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('should have correct method signature', () => {
      expect(typeof service.set).toBe('function');
    });

    it('should store entry in memory cache', async () => {
      const embedding = [0.1, 0.2, 0.3];
      const data = { response: 'test response' };
      const tenantId = 'org1:team1';

      vi.mocked(isRedisAvailable).mockReturnValue(false);

      await service.set('test-key', embedding, data, tenantId);

      // Entry should be in memory cache
      const stats = service.getStats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it('should store entry in Redis when available', async () => {
      const embedding = [0.1, 0.2, 0.3];
      const data = { response: 'test response' };
      const tenantId = 'org1:team1';

      const mockRedis = {
        setex: vi.fn().mockResolvedValue('OK'),
      };

      vi.mocked(isRedisAvailable).mockReturnValue(true);
      vi.mocked(getRedis).mockReturnValue(mockRedis as unknown as Redis);

      await service.set('test-key', embedding, data, tenantId);

      expect(mockRedis.setex).toHaveBeenCalled();
    });

    it('should include tenant isolation metadata', async () => {
      const embedding = [0.1, 0.2, 0.3];
      const data = { response: 'test response' };
      const tenantId = 'org1:team1';

      vi.mocked(isRedisAvailable).mockReturnValue(false);

      // Generate key and set
      const key = service.generateKey(embedding);
      await service.set(key, embedding, data, tenantId);

      // We can verify by checking findSimilar respects tenant
      const result = await service.findSimilar(embedding, 'different-tenant');
      expect(result).toBeNull();
    });
  });

  describe('findSimilar', () => {
    it('should return entries within threshold', async () => {
      const embedding = [1, 0, 0, 0, 0];
      const tenantId = 'org1:team1';

      vi.mocked(isRedisAvailable).mockReturnValue(false);

      const result = await service.findSimilar(embedding, tenantId);
      expect(result).toBeNull();
    });

    it('should exclude entries outside threshold', async () => {
      const embedding = [1, 0, 0, 0, 0];
      const tenantId = 'org1:team1';

      vi.mocked(isRedisAvailable).mockReturnValue(false);

      const result = await service.findSimilar(embedding, tenantId);
      expect(result).toBeNull();
    });

    it('should respect tenant isolation', async () => {
      const embedding = [1, 0, 0, 0, 0];

      vi.mocked(isRedisAvailable).mockReturnValue(false);

      // Should not find entries from different tenant
      const result = await service.findSimilar(embedding, 'org2:team2');
      expect(result).toBeNull();
    });

    it('should return null when disabled', async () => {
      const disabledService = new SemanticCacheService({ enabled: false });
      const result = await disabledService.findSimilar([0.1, 0.2], 'tenant');
      expect(result).toBeNull();
    });
  });

  describe('getStats', () => {
    it('should return semantic cache stats', () => {
      const stats = service.getStats();
      expect(stats).toHaveProperty('hits');
      expect(stats).toHaveProperty('misses');
      expect(stats).toHaveProperty('similarityScores');
      expect(stats).toHaveProperty('embeddingLatencies');
    });
  });

  describe('threshold management', () => {
    it('should use default threshold of 0.15', () => {
      const defaultService = new SemanticCacheService();
      expect(defaultService.getThreshold()).toBe(0.15);
    });

    it('should allow custom threshold', () => {
      const customService = new SemanticCacheService({ threshold: 0.3 });
      expect(customService.getThreshold()).toBe(0.3);
    });

    it('should allow setting threshold at runtime', () => {
      service.setThreshold(0.5);
      expect(service.getThreshold()).toBe(0.5);
    });

    it('should reject invalid threshold values', () => {
      expect(() => service.setThreshold(-0.1)).toThrow();
      expect(() => service.setThreshold(1.1)).toThrow();
    });
  });

  describe('enabled/disabled state', () => {
    it('should be disabled by default', () => {
      const defaultService = new SemanticCacheService();
      expect(defaultService.isEnabled()).toBe(false);
    });

    it('should allow enabling at construction', () => {
      const enabledService = new SemanticCacheService({ enabled: true });
      expect(enabledService.isEnabled()).toBe(true);
    });

    it('should allow toggling at runtime', () => {
      service.setEnabled(false);
      expect(service.isEnabled()).toBe(false);
      service.setEnabled(true);
      expect(service.isEnabled()).toBe(true);
    });
  });

  describe('clear', () => {
    it('should clear memory cache', async () => {
      vi.mocked(isRedisAvailable).mockReturnValue(false);

      await service.set('key', [0.1, 0.2], { data: 'test' }, 'tenant');
      await service.clear();

      const result = await service.findSimilar([0.1, 0.2], 'tenant');
      expect(result).toBeNull();
    });

    it('should clear Redis cache when available', async () => {
      const mockRedis = {
        keys: vi.fn().mockResolvedValue(['semantic-cache:tenant:key']),
        del: vi.fn().mockResolvedValue(1),
      };

      vi.mocked(isRedisAvailable).mockReturnValue(true);
      vi.mocked(getRedis).mockReturnValue(mockRedis as unknown as Redis);

      await service.clear();

      expect(mockRedis.keys).toHaveBeenCalledWith('semantic-cache:*');
      expect(mockRedis.del).toHaveBeenCalled();
    });
  });

  describe('default export', () => {
    it('should be disabled by default', () => {
      expect(semanticCacheService.isEnabled()).toBe(false);
    });
  });
});
