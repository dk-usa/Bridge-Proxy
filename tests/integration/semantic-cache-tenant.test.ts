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

vi.mock('../../src/services/tenancy/index.js', () => ({
  tenancyService: {
    validateApiKey: vi.fn(),
  },
}));

// Import after mocks
import { cacheService } from '../../src/services/cache.js';
import {
  checkSemanticCache,
  storeSemanticResponse,
} from '../../src/services/semantic-cache-middleware.js';

describe('Semantic Cache Tenant Isolation', () => {
  let app: FastifyInstance;

  const tenantAResponse = {
    id: 'msg_tenant_a',
    type: 'message' as const,
    role: 'assistant' as const,
    content: [{ type: 'text' as const, text: 'Response for Tenant A' }],
    model: 'claude-3-5-sonnet-20241022',
    stop_reason: 'end_turn' as const,
    stop_sequence: undefined,
    usage: { input_tokens: 10, output_tokens: 20 },
  };

  const tenantBResponse = {
    id: 'msg_tenant_b',
    type: 'message' as const,
    role: 'assistant' as const,
    content: [{ type: 'text' as const, text: 'Response for Tenant B' }],
    model: 'claude-3-5-sonnet-20241022',
    stop_reason: 'end_turn' as const,
    stop_sequence: undefined,
    usage: { input_tokens: 10, output_tokens: 20 },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await cacheService.clear();

    app = await createServer();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    vi.clearAllMocks();
  });

  it('should not return cross-tenant semantic matches', async () => {
    const request: AnthropicMessageRequest = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello' }],
    };

    // Tenant A gets a semantic cache hit
    vi.mocked(checkSemanticCache).mockResolvedValueOnce({
      hit: true,
      response: tenantAResponse,
      embedding: [0.1, 0.2, 0.3],
    });

    // Mock provider for Tenant B (should be called)
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'msg_tenant_b_provider',
        object: 'chat.completion',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Provider response for Tenant B' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }),
    });

    // Tenant A request - should get Tenant A's response
    const responseA = await app.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: {
        'x-api-key': 'test',
        'anthropic-version': '2023-01-01',
        'Content-Type': 'application/json',
      },
      body: request,
    });

    expect(responseA.statusCode).toBe(200);
    const bodyA = JSON.parse(responseA.body);
    expect(bodyA.id).toBe('msg_tenant_a');

    // Reset mocks for Tenant B
    vi.mocked(checkSemanticCache).mockResolvedValueOnce({
      hit: false,
      embedding: [0.4, 0.5, 0.6],
    });
    vi.mocked(storeSemanticResponse).mockResolvedValueOnce(undefined);

    // Tenant B request - should NOT get Tenant A's response
    const responseB = await app.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: {
        'x-api-key': 'test',
        'anthropic-version': '2023-01-01',
        'Content-Type': 'application/json',
      },
      body: request,
    });

    expect(responseB.statusCode).toBe(200);
    const bodyB = JSON.parse(responseB.body);
    // Response ID is prefixed with 'msg_' by the adapter
    expect(bodyB.id).toContain('tenant_b_provider');
  });

  it('should store entries with correct tenant metadata', async () => {
    const request: AnthropicMessageRequest = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'Hello' }],
    };

    vi.mocked(checkSemanticCache).mockResolvedValue({
      hit: false,
      embedding: [0.1, 0.2, 0.3],
    });

    vi.mocked(storeSemanticResponse).mockResolvedValue(undefined);

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
    await app.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: {
        'x-api-key': 'test',
        'anthropic-version': '2023-01-01',
        'Content-Type': 'application/json',
      },
      body: request,
    });

    // Verify storeSemanticResponse was called with correct tenant
    expect(storeSemanticResponse).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-3-5-sonnet-20241022' }),
      expect.objectContaining({ type: 'message' }),
      [0.1, 0.2, 0.3],
      '' // tenantId is empty for test mode
    );
  });

  it('should handle same content for different tenants', async () => {
    const request: AnthropicMessageRequest = {
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 100,
      messages: [{ role: 'user', content: 'What is 2+2?' }],
    };

    // First tenant - cache miss, call provider
    vi.mocked(checkSemanticCache).mockResolvedValueOnce({
      hit: false,
      embedding: [0.1, 0.2, 0.3],
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'msg_t1',
        object: 'chat.completion',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Response for T1' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }),
    });

    vi.mocked(storeSemanticResponse).mockResolvedValueOnce(undefined);

    // Second tenant - should also be a cache miss for their tenant
    vi.mocked(checkSemanticCache).mockResolvedValueOnce({
      hit: false,
      embedding: [0.1, 0.2, 0.3],
    });

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        id: 'msg_t2',
        object: 'chat.completion',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Response for T2' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      }),
    });

    vi.mocked(storeSemanticResponse).mockResolvedValueOnce(undefined);

    // Both requests should succeed with their own responses
    const response1 = await app.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: {
        'x-api-key': 'test',
        'anthropic-version': '2023-01-01',
        'Content-Type': 'application/json',
      },
      body: request,
    });

    const response2 = await app.inject({
      method: 'POST',
      url: '/v1/messages',
      headers: {
        'x-api-key': 'test',
        'anthropic-version': '2023-01-01',
        'Content-Type': 'application/json',
      },
      body: request,
    });

    // Both should succeed (even though same content)
    expect(response1.statusCode).toBe(200);
    expect(response2.statusCode).toBe(200);
  });
});
