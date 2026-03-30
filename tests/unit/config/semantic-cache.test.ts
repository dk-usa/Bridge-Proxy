import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { configSchema } from '../../../src/config/schema.js';
import { loadConfig, resetConfig } from '../../../src/config/index.js';
import type { z } from 'zod';

describe('Semantic Cache Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetConfig();
    // Create a copy of original env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
    resetConfig();
  });

  describe('Schema validation', () => {
    it('should parse semantic cache config with defaults when env vars not set', () => {
      const result = configSchema.safeParse({
        server: { host: '0.0.0.0', port: 3000 },
        logging: { level: 'info', pretty: false },
        database: { type: 'sqlite' },
        redis: { enabled: true },
        rateLimit: { enabled: true, max: 100, timeWindow: '1 minute' },
        cors: { enabled: true, origin: '*' },
        providers: { primary: { type: 'openai' } },
        router: { strategy: 'failover', circuitBreaker: { enabled: true } },
        cache: { enabled: true, ttl: 3600, prefix: 'llm-cache' },
        streaming: { heartbeatIntervalMs: 10000 },
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.semanticCache).toBeDefined();
        expect(result.data.semanticCache?.enabled).toBe(false);
        expect(result.data.semanticCache?.threshold).toBe(0.15);
        expect(result.data.semanticCache?.ttl).toBe(3600000);
      }
    });

    it('should enable semantic cache when SEMANTIC_CACHE_ENABLED=true', () => {
      process.env.SEMANTIC_CACHE_ENABLED = 'true';
      process.env.PRIMARY_API_KEY = 'test-key';
      process.env.PRIMARY_BASE_URL = 'https://test.com';
      process.env.PRIMARY_MODEL = 'test-model';

      const config = loadConfig(process.env);
      expect(config.semanticCache?.enabled).toBe(true);
    });

    it('should set custom threshold from SEMANTIC_CACHE_THRESHOLD', () => {
      process.env.SEMANTIC_CACHE_ENABLED = 'true';
      process.env.SEMANTIC_CACHE_THRESHOLD = '0.20';
      process.env.PRIMARY_API_KEY = 'test-key';
      process.env.PRIMARY_BASE_URL = 'https://test.com';
      process.env.PRIMARY_MODEL = 'test-model';

      const config = loadConfig(process.env);
      expect(config.semanticCache?.threshold).toBe(0.2);
    });

    it('should reject invalid threshold values below 0', () => {
      const result = configSchema.safeParse({
        server: { host: '0.0.0.0', port: 3000 },
        logging: { level: 'info', pretty: false },
        database: { type: 'sqlite' },
        redis: { enabled: true },
        rateLimit: { enabled: true, max: 100, timeWindow: '1 minute' },
        cors: { enabled: true, origin: '*' },
        providers: { primary: { type: 'openai' } },
        router: { strategy: 'failover', circuitBreaker: { enabled: true } },
        cache: { enabled: true, ttl: 3600, prefix: 'llm-cache' },
        streaming: { heartbeatIntervalMs: 10000 },
        semanticCache: { enabled: true, threshold: -0.1, ttl: 3600000 },
      });

      expect(result.success).toBe(false);
    });

    it('should reject invalid threshold values above 1', () => {
      const result = configSchema.safeParse({
        server: { host: '0.0.0.0', port: 3000 },
        logging: { level: 'info', pretty: false },
        database: { type: 'sqlite' },
        redis: { enabled: true },
        rateLimit: { enabled: true, max: 100, timeWindow: '1 minute' },
        cors: { enabled: true, origin: '*' },
        providers: { primary: { type: 'openai' } },
        router: { strategy: 'failover', circuitBreaker: { enabled: true } },
        cache: { enabled: true, ttl: 3600, prefix: 'llm-cache' },
        streaming: { heartbeatIntervalMs: 10000 },
        semanticCache: { enabled: true, threshold: 1.5, ttl: 3600000 },
      });

      expect(result.success).toBe(false);
    });

    it('should have disabled semantic cache by default', () => {
      process.env.PRIMARY_API_KEY = 'test-key';
      process.env.PRIMARY_BASE_URL = 'https://test.com';
      process.env.PRIMARY_MODEL = 'test-model';

      const config = loadConfig(process.env);
      expect(config.semanticCache?.enabled).toBe(false);
    });

    it('should load SEMANTIC_CACHE_TTL from env', () => {
      process.env.SEMANTIC_CACHE_ENABLED = 'true';
      process.env.SEMANTIC_CACHE_TTL = '7200000'; // 2 hours
      process.env.PRIMARY_API_KEY = 'test-key';
      process.env.PRIMARY_BASE_URL = 'https://test.com';
      process.env.PRIMARY_MODEL = 'test-model';

      const config = loadConfig(process.env);
      expect(config.semanticCache?.ttl).toBe(7200000);
    });

    it('should load SEMANTIC_CACHE_EMBEDDING_MODEL from env', () => {
      process.env.SEMANTIC_CACHE_ENABLED = 'true';
      process.env.SEMANTIC_CACHE_EMBEDDING_MODEL = 'text-embedding-3-small';
      process.env.PRIMARY_API_KEY = 'test-key';
      process.env.PRIMARY_BASE_URL = 'https://test.com';
      process.env.PRIMARY_MODEL = 'test-model';

      const config = loadConfig(process.env);
      expect(config.semanticCache?.embeddingModel).toBe('text-embedding-3-small');
    });
  });

  describe('Config interface', () => {
    it('should include semanticCache in Config type', () => {
      process.env.PRIMARY_API_KEY = 'test-key';
      process.env.PRIMARY_BASE_URL = 'https://test.com';
      process.env.PRIMARY_MODEL = 'test-model';

      const config = loadConfig(process.env);

      // TypeScript will enforce this at compile time
      expect(config.semanticCache).toBeDefined();
      expect(typeof config.semanticCache?.enabled).toBe('boolean');
      expect(typeof config.semanticCache?.threshold).toBe('number');
      expect(typeof config.semanticCache?.ttl).toBe('number');
    });
  });
});
