import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { registerAdminRoutes } from '../../src/admin/index.js';
import { semanticCacheService } from '../../src/services/semantic-cache.js';
import { resetConfig } from '../../src/config/index.js';

describe('Admin Semantic Cache Stats Endpoint', () => {
  let app: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    app = Fastify();
    process.env.ADMIN_TOKEN = 'test-admin-token';
    process.env.PRIMARY_API_KEY = 'test-key';
    process.env.PRIMARY_BASE_URL = 'https://test.com';
    process.env.PRIMARY_MODEL = 'test-model';
    resetConfig();

    await registerAdminRoutes(app);
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.ADMIN_TOKEN;
  });

  beforeEach(() => {
    semanticCacheService.resetStats();
  });

  describe('GET /admin/semantic-cache/stats', () => {
    it('should return stats object with all metrics', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/semantic-cache/stats',
        headers: {
          Authorization: 'Bearer test-admin-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveProperty('enabled');
      expect(body).toHaveProperty('threshold');
      expect(body).toHaveProperty('hits');
      expect(body).toHaveProperty('misses');
      expect(body).toHaveProperty('hitRate');
      expect(body).toHaveProperty('avgSimilarityScore');
      expect(body).toHaveProperty('avgEmbeddingLatencyMs');
      expect(body).toHaveProperty('estimatedCostSavings');
    });

    it('should require admin authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/semantic-cache/stats',
      });

      expect(response.statusCode).toBe(401);
    });

    it('should reject invalid admin token', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/semantic-cache/stats',
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it('should return disabled status when semantic cache is disabled', async () => {
      // Ensure semantic cache is disabled
      semanticCacheService.setEnabled(false);

      const response = await app.inject({
        method: 'GET',
        url: '/semantic-cache/stats',
        headers: {
          Authorization: 'Bearer test-admin-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.enabled).toBe(false);
    });

    it('should return enabled status and threshold from config', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/semantic-cache/stats',
        headers: {
          Authorization: 'Bearer test-admin-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      // Default threshold is 0.15
      expect(body.threshold).toBe(0.15);
    });
  });
});
