import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { FastifyInstance } from 'fastify';

// Use vi.hoisted to create mock functions that can be used in hoisted mocks
const mockListKeys = vi.hoisted(() => vi.fn());
const mockGetCostByKey = vi.hoisted(() => vi.fn());
const mockGetAllCostsByModel = vi.hoisted(() => vi.fn());
const mockGetAllFallbackFrequency = vi.hoisted(() => vi.fn());
const mockGetAllCostsByKey = vi.hoisted(() => vi.fn());
const mockGetLatencyStats = vi.hoisted(() => vi.fn());

// Mock the modules BEFORE importing the route
vi.mock('../../../src/services/observability.js', () => ({
  observabilityService: {
    getCostByKey: mockGetCostByKey,
    getAllCostsByModel: mockGetAllCostsByModel,
    getAllFallbackFrequency: mockGetAllFallbackFrequency,
    getAllCostsByKey: mockGetAllCostsByKey,
    getLatencyStats: mockGetLatencyStats,
  },
}));

vi.mock('../../../src/virtual-keys/service.js', () => ({
  getVirtualKeyService: () => ({
    listKeys: mockListKeys,
  }),
}));

vi.mock('../../../src/config/index.js', () => ({
  getLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
  }),
}));

// Import after mocks are set up
import { observabilityRoutes } from '../../../src/admin/observability.js';

// Helper to build Fastify app
async function buildApp(): Promise<FastifyInstance> {
  const { default: Fastify } = await import('fastify');
  const app = Fastify();
  await app.register(observabilityRoutes, { prefix: '/admin' });
  return app;
}

describe('Admin Observability Routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  describe('GET /admin/costs/by-key', () => {
    it('should return costs aggregated by virtual key', async () => {
      mockListKeys.mockResolvedValue([
        { id: 'key-1', name: 'Production Key' },
        { id: 'key-2', name: 'Dev Key' },
      ]);
      mockGetCostByKey.mockResolvedValueOnce(150.5);
      mockGetCostByKey.mockResolvedValueOnce(25.75);

      app = await buildApp();
      const response = await app.inject({
        method: 'GET',
        url: '/admin/costs/by-key',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.costs).toHaveLength(2);
      expect(body.costs[0].keyId).toBe('key-1');
      expect(body.costs[0].totalCost).toBe(150.5);
      expect(body.costs[1].keyId).toBe('key-2');
    });

    it('should validate date range query parameters', async () => {
      mockListKeys.mockResolvedValue([]);

      app = await buildApp();
      const response = await app.inject({
        method: 'GET',
        url: '/admin/costs/by-key?startDate=2024-01-01&endDate=2024-12-31',
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('GET /admin/costs/by-model', () => {
    it('should return costs aggregated by model', async () => {
      const costsByModel = new Map([
        ['gpt-4', 500.25],
        ['claude-3-opus', 300.0],
      ]);
      mockGetAllCostsByModel.mockResolvedValue(costsByModel);

      app = await buildApp();
      const response = await app.inject({
        method: 'GET',
        url: '/admin/costs/by-model',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.costs).toHaveLength(2);

      const gpt4Cost = body.costs.find((c: { model: string }) => c.model === 'gpt-4');
      expect(gpt4Cost.totalCost).toBe(500.25);
    });

    it('should return empty array when no costs recorded', async () => {
      mockGetAllCostsByModel.mockResolvedValue(new Map());

      app = await buildApp();
      const response = await app.inject({
        method: 'GET',
        url: '/admin/costs/by-model',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.costs).toHaveLength(0);
    });
  });

  describe('GET /admin/fallbacks', () => {
    it('should return fallback frequency by source provider', async () => {
      const fallbackFreq = new Map([
        ['primary-openai', 45],
        ['primary-anthropic', 12],
      ]);
      mockGetAllFallbackFrequency.mockResolvedValue(fallbackFreq);

      app = await buildApp();
      const response = await app.inject({
        method: 'GET',
        url: '/admin/fallbacks',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.fallbacks).toHaveLength(2);

      const primaryOpenai = body.fallbacks.find(
        (f: { fromProvider: string }) => f.fromProvider === 'primary-openai'
      );
      expect(primaryOpenai.count).toBe(45);
    });

    it('should return empty array when no fallbacks recorded', async () => {
      mockGetAllFallbackFrequency.mockResolvedValue(new Map());

      app = await buildApp();
      const response = await app.inject({
        method: 'GET',
        url: '/admin/fallbacks',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.fallbacks).toHaveLength(0);
    });
  });

  describe('GET /admin/latency/:providerId/:model', () => {
    it('should return latency percentiles for provider/model', async () => {
      mockGetLatencyStats.mockResolvedValue({
        p50: 150,
        p95: 350,
        p99: 500,
        count: 100,
      });

      app = await buildApp();
      const response = await app.inject({
        method: 'GET',
        url: '/admin/latency/openai/gpt-4',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.providerId).toBe('openai');
      expect(body.model).toBe('gpt-4');
      expect(body.p50).toBe(150);
      expect(body.p95).toBe(350);
      expect(body.p99).toBe(500);
      expect(body.count).toBe(100);
    });

    it('should return zeros for provider/model with no data', async () => {
      mockGetLatencyStats.mockResolvedValue({
        p50: 0,
        p95: 0,
        p99: 0,
        count: 0,
      });

      app = await buildApp();
      const response = await app.inject({
        method: 'GET',
        url: '/admin/latency/nonexistent/model',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.count).toBe(0);
    });
  });

  describe('GET /admin/summary', () => {
    it('should return aggregated observability summary', async () => {
      const costsByKey = new Map([
        ['key-1', 100],
        ['key-2', 200],
      ]);
      const costsByModel = new Map([
        ['gpt-4', 150],
        ['claude-3', 150],
      ]);
      const fallbacks = new Map([['primary', 10]]);

      mockGetAllCostsByKey.mockResolvedValue(costsByKey);
      mockGetAllCostsByModel.mockResolvedValue(costsByModel);
      mockGetAllFallbackFrequency.mockResolvedValue(fallbacks);

      app = await buildApp();
      const response = await app.inject({
        method: 'GET',
        url: '/admin/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.totalCost).toBe(300); // 100 + 200
      expect(body.totalFallbacks).toBe(10);
      expect(body.keysTracked).toBe(2);
      expect(body.modelsTracked).toBe(2);
    });

    it('should handle empty data gracefully', async () => {
      mockGetAllCostsByKey.mockResolvedValue(new Map());
      mockGetAllCostsByModel.mockResolvedValue(new Map());
      mockGetAllFallbackFrequency.mockResolvedValue(new Map());

      app = await buildApp();
      const response = await app.inject({
        method: 'GET',
        url: '/admin/summary',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.totalCost).toBe(0);
      expect(body.totalFallbacks).toBe(0);
      expect(body.keysTracked).toBe(0);
      expect(body.modelsTracked).toBe(0);
    });
  });
});
