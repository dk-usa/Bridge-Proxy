import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createServer } from '../../src/server/index.js';
import type { AnthropicMessageRequest } from '../../src/schemas/anthropic.js';

// Mock the semantic-cache-middleware module
vi.mock('../../src/services/semantic-cache-middleware.js', () => ({
  checkSemanticCache: vi.fn(),
  storeSemanticResponse: vi.fn(),
}));

// Mock dependencies
vi.mock('../../src/services/redis.js', () => ({
  getRedis: vi.fn(),
  isRedisAvailable: vi.fn(() => false),
}));

vi.mock('../../src/services/index.js', () => ({
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

vi.mock('../../src/admin-store.js', () => ({
  adminStore: {
    resolveModel: vi.fn((model: string) => ({
      providerId: 'nim',
      providerModel: 'test-model',
      anthropicModel: model,
    })),
    getProviderById: vi.fn(() => ({
      id: 'nim',
      type: 'openai-compatible',
      baseUrl: 'https://test.api.com/v1',
      apiKey: 'test-key',
      models: ['test-model'],
      timeoutMs: 60000,
      enabled: true,
      priority: 10,
    })),
    addLog: vi.fn(),
    getLogs: vi.fn(() => []),
  },
}));

// Import after mocks
import { getConfig } from '../../src/config/index.js';
import { semanticCacheService } from '../../src/services/semantic-cache.js';
import { cacheService } from '../../src/services/cache.js';
import {
  checkSemanticCache,
  storeSemanticResponse,
} from '../../src/services/semantic-cache-middleware.js';

describe('Semantic cache pipeline integration', () => {
  let app: FastifyInstance;

  const mockResponse = {
    id: 'msg_test',
    type: 'message' as const,
    role: 'assistant' as const,
    content: [{ type: 'text' as const, text: 'Test response' }],
    model: 'claude-3-5-sonnet-20241022',
    stop_reason: 'end_turn' as const,
    stop_sequence: undefined,
    usage: { input_tokens: 10, output_tokens: 20 },
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    // Clear caches
    await cacheService.clear();
    await semanticCacheService.clear();

    // Build app
    app = await createServer();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  describe('exact cache flow', () => {
    it('should return exact cache hit without checking semantic', async () => {
      // Setup: store in exact cache
      const request: AnthropicMessageRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'What is 2+2?' }],
      };

      const cacheKey = cacheService.generateRequestKey(request.model, request.messages, {
        max_tokens: request.max_tokens,
      });
      await cacheService.set(cacheKey, mockResponse, 'tenant-1');

      // Mock provider to fail if called
      global.fetch = vi.fn().mockImplementation(() => {
        throw new Error('Provider should not be called on exact cache hit');
      });

      // Make request
      const response = await app.inject({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'x-api-key': 'test',
          'anthropic-version': '2023-01-01',
          'Content-Type': 'application/json',
        },
        body: request,
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe('msg_test');

      // Verify semantic cache was not called
      expect(semanticCacheService.getStats().hits).toBe(0);
    });
  });

  describe('semantic cache flow', () => {
    it('should check semantic cache after exact cache miss', async () => {
      const request: AnthropicMessageRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'What is 2+2?' }],
      };

      // Mock semantic cache hit
      vi.mocked(checkSemanticCache).mockResolvedValue({
        hit: true,
        response: mockResponse,
        embedding: [0.1, 0.2, 0.3],
      });

      // Mock provider to fail if called
      global.fetch = vi.fn().mockImplementation(() => {
        throw new Error('Provider should not be called on semantic cache hit');
      });

      // Make request
      const response = await app.inject({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'x-api-key': 'test',
          'anthropic-version': '2023-01-01',
          'Content-Type': 'application/json',
        },
        body: request,
      });

      expect(response.statusCode).toBe(200);
      expect(checkSemanticCache).toHaveBeenCalled();
    });

    it('should call provider when both caches miss', async () => {
      const request: AnthropicMessageRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'What is 2+2?' }],
      };

      // Mock semantic cache miss
      vi.mocked(checkSemanticCache).mockResolvedValue({
        hit: false,
        embedding: [0.1, 0.2, 0.3],
      });

      vi.mocked(storeSemanticResponse).mockResolvedValue(undefined);

      // Mock provider response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'msg_provider',
          object: 'chat.completion',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Provider response' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
      });

      // Make request
      const response = await app.inject({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'x-api-key': 'test',
          'anthropic-version': '2023-01-01',
          'Content-Type': 'application/json',
        },
        body: request,
      });

      expect(response.statusCode).toBe(200);
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should fall back to provider when semantic cache disabled', async () => {
      const request: AnthropicMessageRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'What is 2+2?' }],
      };

      // Mock semantic cache disabled (returns hit: false)
      vi.mocked(checkSemanticCache).mockResolvedValue({ hit: false });

      // Mock provider response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'msg_provider',
          object: 'chat.completion',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Provider response' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
      });

      // Make request
      const response = await app.inject({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'x-api-key': 'test',
          'anthropic-version': '2023-01-01',
          'Content-Type': 'application/json',
        },
        body: request,
      });

      expect(response.statusCode).toBe(200);
      // Semantic cache should have been checked
      expect(checkSemanticCache).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should gracefully continue when embedding fails', async () => {
      const request: AnthropicMessageRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'What is 2+2?' }],
      };

      // Mock embedding failure (returns hit: false)
      vi.mocked(checkSemanticCache).mockResolvedValue({ hit: false });

      // Mock provider response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          id: 'msg_provider',
          object: 'chat.completion',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Provider response' },
              finish_reason: 'stop',
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
        }),
      });

      // Make request
      const response = await app.inject({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'x-api-key': 'test',
          'anthropic-version': '2023-01-01',
          'Content-Type': 'application/json',
        },
        body: request,
      });

      // Should still work despite embedding failure
      expect(response.statusCode).toBe(200);
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
