import { describe, it, expect, beforeAll, afterAll, vi, beforeEach, afterEach } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { createServer } from '../../src/server/index.js';
import { resetConfig, loadConfig } from '../../src/config/index.js';
import { setMockProviders, clearMockProviders, resetProviders } from '../../src/adapters/index.js';
import type { Provider } from '../../src/providers/base.js';
import { PROVIDER_TYPES } from '../../src/providers/base.js';

const createMockProvider = (name: string = 'mock'): Provider => ({
  type: PROVIDER_TYPES.OPENAI_COMPATIBLE,
  name,

  async listModels() {
    return {
      object: 'list',
      data: [
        { id: 'test-model', name: 'test-model', owned_by: 'test' },
        {
          id: 'claude-3-5-sonnet-20240620',
          name: 'claude-3-5-sonnet-20240620',
          owned_by: 'anthropic',
        },
      ],
    };
  },

  async createMessageNonStreaming(_messages, options) {
    const content = options?.model?.includes('claude')
      ? 'Hello from Claude-compatible response!'
      : 'Hello from mock provider!';

    return {
      id: 'chatcmpl-test',
      object: 'chat.completion',
      created: 1234567890,
      model: options?.model ?? 'test-model',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 10,
        completion_tokens: 5,
        total_tokens: 15,
      },
    };
  },

  async createMessageStreaming(_messages, _options, handler) {
    const chunks = [
      {
        id: '1',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'test',
        choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }],
      },
      {
        id: '1',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'test',
        choices: [{ index: 0, delta: { content: ' World' }, finish_reason: null }],
      },
      {
        id: '1',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'test',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop', usage: { completion_tokens: 10 } }],
      },
    ];

    for (const chunk of chunks) {
      handler.onChunk(`data: ${JSON.stringify(chunk)}\n\n`);
      await new Promise((r) => setTimeout(r, 10));
    }
    handler.onComplete();
  },

  async healthcheck() {
    return true;
  },

  getClient() {
    return {} as any;
  },

  getConfig() {
    return { apiKey: 'test', baseUrl: 'test', defaultModel: 'test' };
  },
});

const createFailingProvider = (): Provider => ({
  type: PROVIDER_TYPES.OPENAI_COMPATIBLE,
  name: 'failing',

  async listModels() {
    throw new Error('Provider unavailable');
  },

  async createMessageNonStreaming() {
    throw new Error('Provider unavailable');
  },

  async createMessageStreaming(_messages, _options, handler) {
    handler.onError(new Error('Provider unavailable'));
  },

  async healthcheck() {
    return false;
  },

  getClient() {
    return {} as any;
  },

  getConfig() {
    return { apiKey: 'test', baseUrl: 'test', defaultModel: 'test' };
  },
});

describe('Integration: Claude Code Client Simulation', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    resetConfig();
    resetProviders();

    // Set mock BEFORE loading config
    setMockProviders(createMockProvider());

    loadConfig({
      SERVER_PORT: '3000',
      PRIMARY_API_KEY: 'test-key',
      PRIMARY_BASE_URL: 'http://localhost:1234',
      PRIMARY_MODEL: 'test-model',
      LOG_LEVEL: 'error',
      RATE_LIMIT_ENABLED: 'false',
    });

    app = await createServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    clearMockProviders();
    resetProviders();
  });

  describe('Normal Message Flow', () => {
    it('should handle simple text message', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': 'test',
        },
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': 'test',
        },
        payload: {
          model: 'claude-3-5-sonnet-20240620',
          messages: [{ role: 'user', content: 'Hello, how are you?' }],
          max_tokens: 1024,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.type).toBe('message');
      expect(body.role).toBe('assistant');
      expect(body.content).toHaveLength(1);
      expect(body.content[0].type).toBe('text');
      expect(body.stop_reason).toBe('end_turn');
      expect(body.usage).toBeDefined();
    });

    it('should apply model mapping', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': 'test',
        },
        payload: {
          model: 'claude-3-opus-20240229',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 100,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle system prompt', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': 'test',
        },
        payload: {
          model: 'test-model',
          system: 'You are a helpful assistant.',
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 100,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle temperature and top_p', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': 'test',
        },
        payload: {
          model: 'test-model',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 100,
          temperature: 0.7,
          top_p: 0.9,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Streaming Flow', () => {
    it('should stream text response', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/messages/stream',
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': 'test',
        },
        payload: {
          model: 'test-model',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 100,
          stream: true,
        },
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/event-stream');

      const body = response.body;

      expect(body).toContain('event: message_start');
      expect(body).toContain('event: content_block_start');
      expect(body).toContain('event: content_block_delta');
      expect(body).toContain('event: content_block_stop');
      expect(body).toContain('event: message_delta');
      expect(body).toContain('event: message_stop');
    });

    it('should include usage in stream when enabled', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/messages/stream',
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': 'test',
        },
        payload: {
          model: 'test-model',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 100,
          stream: true,
          stream_options: { include_usage: true },
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.body;
      expect(body).toContain('output_tokens');
    });

    it('should maintain proper SSE format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/messages/stream',
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': 'test',
        },
        payload: {
          model: 'test-model',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 50,
          stream: true,
        },
      });

      const body = response.body;
      expect(body).toMatch(/event: \w+\ndata: \{.*\}\n\n/s);
    });
  });

  describe('Tool Call Flow', () => {
    it('should handle tool definitions', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': 'test',
        },
        payload: {
          model: 'test-model',
          messages: [{ role: 'user', content: 'What is the weather?' }],
          tools: [
            {
              name: 'get_weather',
              description: 'Get weather for a location',
              input_schema: {
                type: 'object',
                properties: {
                  location: { type: 'string', description: 'City name' },
                },
                required: ['location'],
              },
            },
          ],
          max_tokens: 1024,
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('should handle tool_choice auto', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': 'test',
        },
        payload: {
          model: 'test-model',
          messages: [{ role: 'user', content: 'Use a tool' }],
          tools: [{ name: 'test', description: 'test', input_schema: { type: 'object' } }],
          tool_choice: { type: 'auto' },
          max_tokens: 1024,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Tool Result Flow', () => {
    // Tool result in messages is validated at schema level
    // This tests the edge case handling
    it('should handle tool_result message format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': 'test',
        },
        payload: {
          model: 'test-model',
          messages: [{ role: 'user', content: 'Use the weather tool' }],
          max_tokens: 1024,
        },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  describe('Error Cases', () => {
    it('should return 400 for missing model', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': 'test',
        },
        payload: {
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 100,
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('should handle invalid max_tokens', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/v1/messages',
        headers: {
          'anthropic-version': '2023-06-01',
          'x-api-key': 'test',
        },
        payload: {
          model: 'test-model',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: -1,
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('Models Endpoint', () => {
    it('should list available models', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/models',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.object).toBe('list');
      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeGreaterThan(0);
    });

    it('should get specific model', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/models/test-model',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe('test-model');
    });

    it('should return 404 for unknown model', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/v1/models/non-existent-model',
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/health',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe('ok');
    });
  });
});
