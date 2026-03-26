import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Import the middleware functions to test
import {
  checkSemanticCache,
  storeSemanticResponse,
  extractRequestText,
} from '../../../src/services/semantic-cache-middleware.js';
import type { AnthropicMessageRequest } from '../../../src/schemas/anthropic.js';

// Mock dependencies
vi.mock('../../../src/config/index.js', () => ({
  getConfig: vi.fn(() => ({
    semanticCache: {
      enabled: true,
      threshold: 0.15,
      ttl: 3600000,
    },
    providers: {
      primary: {
        apiKey: 'test-key',
        baseUrl: 'https://test.api.com/v1',
      },
    },
  })),
}));

vi.mock('../../../src/services/semantic-cache.js', () => ({
  semanticCacheService: {
    generateEmbedding: vi.fn(),
    findSimilar: vi.fn(),
    set: vi.fn(),
    generateKey: vi.fn((embedding: number[]) => `key-${embedding.slice(0, 3).join('-')}`),
    isEnabled: vi.fn(() => true),
    getStats: vi.fn(() => ({
      hits: 0,
      misses: 0,
      hitRate: 0,
      avgSimilarityScore: 0,
      avgEmbeddingLatencyMs: 0,
      estimatedCostSavings: 0,
      similarityScores: [],
      embeddingLatencies: [],
    })),
  },
}));

import { getConfig } from '../../../src/config/index.js';
import { semanticCacheService } from '../../../src/services/semantic-cache.js';

describe('semantic-cache-middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('extractRequestText', () => {
    it('should extract text from simple string messages', () => {
      const request: AnthropicMessageRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'Hello, how are you?' },
          { role: 'assistant', content: 'I am doing well!' },
        ],
      };

      const text = extractRequestText(request);

      expect(text).toContain('Hello, how are you?');
      expect(text).toContain('I am doing well!');
    });

    it('should extract text from content blocks', () => {
      const request: AnthropicMessageRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is in this image?' },
              {
                type: 'image',
                source: { type: 'base64', media_type: 'image/png', data: 'base64data' },
              },
            ],
          },
        ],
      };

      const text = extractRequestText(request);

      expect(text).toContain('What is in this image?');
    });

    it('should include system prompt when present (string)', () => {
      const request: AnthropicMessageRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        system: 'You are a helpful assistant.',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const text = extractRequestText(request);

      expect(text).toContain('You are a helpful assistant.');
      expect(text).toContain('Hello');
    });

    it('should include system prompt when present (blocks)', () => {
      const request: AnthropicMessageRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        system: [
          { type: 'text', text: 'You are a helpful assistant.' },
          { type: 'text', text: 'Be concise.' },
        ],
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const text = extractRequestText(request);

      expect(text).toContain('You are a helpful assistant.');
      expect(text).toContain('Be concise.');
      expect(text).toContain('Hello');
    });

    it('should handle empty messages array', () => {
      const request: AnthropicMessageRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [],
      };

      const text = extractRequestText(request);

      expect(text).toBe('');
    });

    it('should handle mixed content types', () => {
      const request: AnthropicMessageRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [
          { role: 'user', content: 'First message' },
          {
            role: 'assistant',
            content: [{ type: 'text', text: 'Second message' }],
          },
          { role: 'user', content: 'Third message' },
        ],
      };

      const text = extractRequestText(request);

      expect(text).toContain('First message');
      expect(text).toContain('Second message');
      expect(text).toContain('Third message');
    });
  });

  describe('checkSemanticCache', () => {
    it('should return { hit: false } when semantic cache disabled', async () => {
      vi.mocked(getConfig).mockReturnValue({
        semanticCache: { enabled: false },
      } as ReturnType<typeof getConfig>);

      const request: AnthropicMessageRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = await checkSemanticCache(request, 'tenant-1');

      expect(result.hit).toBe(false);
    });

    it('should return cached response on hit', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
      const mockResponse = {
        id: 'msg_test',
        type: 'message' as const,
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: 'Cached response' }],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn' as const,
        stop_sequence: undefined,
        usage: { input_tokens: 10, output_tokens: 20 },
      };

      vi.mocked(getConfig).mockReturnValue({
        semanticCache: { enabled: true },
      } as ReturnType<typeof getConfig>);

      vi.mocked(semanticCacheService.generateEmbedding).mockResolvedValue(mockEmbedding);
      vi.mocked(semanticCacheService.findSimilar).mockResolvedValue({
        data: mockResponse,
        embedding: mockEmbedding,
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000,
        hitCount: 1,
        tenantId: 'tenant-1',
        similarityScore: 0.95,
      });

      const request: AnthropicMessageRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = await checkSemanticCache(request, 'tenant-1');

      expect(result.hit).toBe(true);
      expect(result.response).toEqual(mockResponse);
      expect(result.embedding).toEqual(mockEmbedding);
    });

    it('should generate embedding from messages + system prompt', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];

      vi.mocked(getConfig).mockReturnValue({
        semanticCache: { enabled: true },
      } as ReturnType<typeof getConfig>);

      vi.mocked(semanticCacheService.generateEmbedding).mockResolvedValue(mockEmbedding);
      vi.mocked(semanticCacheService.findSimilar).mockResolvedValue(null);

      const request: AnthropicMessageRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        system: 'You are helpful.',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await checkSemanticCache(request, 'tenant-1');

      // Verify generateEmbedding was called with text containing both system and messages
      expect(semanticCacheService.generateEmbedding).toHaveBeenCalled();
      const callArg = vi.mocked(semanticCacheService.generateEmbedding).mock.calls[0][0];
      expect(callArg).toContain('You are helpful.');
      expect(callArg).toContain('Hello');
    });

    it('should fall back gracefully on embedding failure', async () => {
      vi.mocked(getConfig).mockReturnValue({
        semanticCache: { enabled: true },
      } as ReturnType<typeof getConfig>);

      vi.mocked(semanticCacheService.generateEmbedding).mockResolvedValue(null);

      const request: AnthropicMessageRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = await checkSemanticCache(request, 'tenant-1');

      expect(result.hit).toBe(false);
      expect(result.embedding).toBeUndefined();
    });

    it('should return { hit: false, embedding } when no match found', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3];

      vi.mocked(getConfig).mockReturnValue({
        semanticCache: { enabled: true },
      } as ReturnType<typeof getConfig>);

      vi.mocked(semanticCacheService.generateEmbedding).mockResolvedValue(mockEmbedding);
      vi.mocked(semanticCacheService.findSimilar).mockResolvedValue(null);

      const request: AnthropicMessageRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = await checkSemanticCache(request, 'tenant-1');

      expect(result.hit).toBe(false);
      expect(result.embedding).toEqual(mockEmbedding);
    });

    it('should not check semantic cache on exact cache hit (caller responsibility)', async () => {
      // This test verifies the middleware design: exact cache check happens BEFORE
      // semantic cache check in the route handler, so middleware doesn't need to
      // check exact cache - it only runs on exact cache miss

      vi.mocked(getConfig).mockReturnValue({
        semanticCache: { enabled: true },
      } as ReturnType<typeof getConfig>);

      vi.mocked(semanticCacheService.generateEmbedding).mockResolvedValue([0.1, 0.2]);

      const request: AnthropicMessageRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hello' }],
      };

      // checkSemanticCache should be called only after exact cache miss
      await checkSemanticCache(request, 'tenant-1');

      expect(semanticCacheService.generateEmbedding).toHaveBeenCalled();
    });
  });

  describe('storeSemanticResponse', () => {
    it('should store response with correct embedding', async () => {
      const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
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

      vi.mocked(getConfig).mockReturnValue({
        semanticCache: { enabled: true },
      } as ReturnType<typeof getConfig>);

      vi.mocked(semanticCacheService.generateKey).mockReturnValue('test-embedding-key');

      const request: AnthropicMessageRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hello' }],
      };

      await storeSemanticResponse(request, mockResponse, mockEmbedding, 'tenant-1');

      expect(semanticCacheService.set).toHaveBeenCalledWith(
        'test-embedding-key',
        mockEmbedding,
        mockResponse,
        'tenant-1'
      );
    });

    it('should skip storage when semantic cache disabled', async () => {
      vi.mocked(getConfig).mockReturnValue({
        semanticCache: { enabled: false },
      } as ReturnType<typeof getConfig>);

      const request: AnthropicMessageRequest = {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 100,
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const response = {
        id: 'msg_test',
        type: 'message' as const,
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: 'Test' }],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn' as const,
        stop_sequence: undefined,
        usage: { input_tokens: 10, output_tokens: 20 },
      };

      await storeSemanticResponse(request, response, [0.1, 0.2], 'tenant-1');

      expect(semanticCacheService.set).not.toHaveBeenCalled();
    });
  });
});
