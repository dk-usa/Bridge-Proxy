import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  OpenAICompatibleProvider,
} from '../../src/providers/openai-compatible.js';
import {
  AnthropicProvider,
} from '../../src/providers/anthropic.js';
import {
  createProvider,
  isOpenAICompatibleProvider,
  isAnthropicProvider,
} from '../../src/providers/index.js';
import { PROVIDER_TYPES, type Provider, type ProviderConfig } from '../../src/providers/base.js';
import { classifyError, isRetryableError, getErrorMessage, getErrorType } from '../../src/providers/errors.js';
import { PROVIDER_ERROR_TYPES } from '../../src/providers/base.js';

describe('Provider Interface', () => {
  describe('Provider Type Constants', () => {
    it('should have correct provider types', () => {
      expect(PROVIDER_TYPES.OPENAI_COMPATIBLE).toBe('openai-compatible');
      expect(PROVIDER_TYPES.ANTHROPIC).toBe('anthropic');
    });
  });

  describe('createProvider', () => {
    const mockConfig: ProviderConfig = {
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'test-key',
      defaultModel: 'test-model',
      timeout: 30000,
      maxRetries: 3,
    };

    it('should create OpenAICompatibleProvider', () => {
      const provider = createProvider(PROVIDER_TYPES.OPENAI_COMPATIBLE, mockConfig);
      expect(provider).toBeInstanceOf(OpenAICompatibleProvider);
      expect(provider.type).toBe(PROVIDER_TYPES.OPENAI_COMPATIBLE);
    });

    it('should create AnthropicProvider', () => {
      const provider = createProvider(PROVIDER_TYPES.ANTHROPIC, mockConfig);
      expect(provider).toBeInstanceOf(AnthropicProvider);
      expect(provider.type).toBe(PROVIDER_TYPES.ANTHROPIC);
    });

    it('should throw on unknown provider type', () => {
      expect(() => createProvider('unknown' as any, mockConfig)).toThrow('Unknown provider type');
    });
  });

  describe('Provider Type Guards', () => {
    const mockConfig: ProviderConfig = {
      baseUrl: 'https://api.example.com/v1',
      apiKey: 'test-key',
    };

    it('should correctly identify OpenAICompatibleProvider', () => {
      const provider = createProvider(PROVIDER_TYPES.OPENAI_COMPATIBLE, mockConfig);
      expect(isOpenAICompatibleProvider(provider)).toBe(true);
      expect(isAnthropicProvider(provider)).toBe(false);
    });

    it('should correctly identify AnthropicProvider', () => {
      const provider = createProvider(PROVIDER_TYPES.ANTHROPIC, mockConfig);
      expect(isOpenAICompatibleProvider(provider)).toBe(false);
      expect(isAnthropicProvider(provider)).toBe(true);
    });
  });
});

describe('Error Classification', () => {
  describe('classifyError', () => {
    it('should classify OpenAI 400 errors', () => {
      const error = { status: 400, data: { error: { type: 'invalid_request_error', message: 'Invalid request' } } };
      const result = classifyError(error, 'openai');
      
      expect(result.type).toBe(PROVIDER_ERROR_TYPES.INVALID_REQUEST);
      expect(result.statusCode).toBe(400);
      expect(result.isRetryable).toBe(false);
      expect(result.provider).toBe('openai');
    });

    it('should classify OpenAI 401 errors', () => {
      const error = { status: 401, data: { error: { type: 'authentication_error', message: 'Invalid API key' } } };
      const result = classifyError(error, 'openai');
      
      expect(result.type).toBe(PROVIDER_ERROR_TYPES.AUTHENTICATION);
      expect(result.isRetryable).toBe(false);
    });

    it('should classify OpenAI 429 errors as retryable', () => {
      const error = { status: 429, data: { error: { type: 'rate_limit_error', message: 'Rate limit' } } };
      const result = classifyError(error, 'openai');
      
      expect(result.type).toBe(PROVIDER_ERROR_TYPES.RATE_LIMIT);
      expect(result.isRetryable).toBe(true);
    });

    it('should classify OpenAI 500 errors as retryable', () => {
      const error = { status: 500, data: { error: { message: 'Internal error' } } };
      const result = classifyError(error, 'openai');
      
      expect(result.type).toBe(PROVIDER_ERROR_TYPES.INTERNAL);
      expect(result.isRetryable).toBe(true);
    });

    it('should classify Anthropic 429 errors', () => {
      const error = { response: { status: 429, data: { error: { type: 'rate_limit_error', message: 'Rate limit exceeded' } } } };
      const result = classifyError(error, 'anthropic');
      
      expect(result.type).toBe(PROVIDER_ERROR_TYPES.RATE_LIMIT);
      expect(result.isRetryable).toBe(true);
    });

    it('should classify Anthropic 529 as overloaded', () => {
      const error = { response: { status: 529, data: { error: { message: 'Service overloaded' } } } };
      const result = classifyError(error, 'anthropic');
      
      expect(result.type).toBe(PROVIDER_ERROR_TYPES.OVERLOADED);
      expect(result.isRetryable).toBe(true);
    });

    it('should classify timeout errors', () => {
      const error = new Error('Request timeout') as Error & { code: string };
      error.code = 'ETIMEDOUT';
      
      const result = classifyError(error, 'test');
      
      expect(result.type).toBe(PROVIDER_ERROR_TYPES.TIMEOUT);
      expect(result.isRetryable).toBe(true);
    });

    it('should classify network errors', () => {
      const error = new Error('Connection refused') as Error & { code: string };
      error.code = 'ECONNREFUSED';
      
      const result = classifyError(error, 'test');
      
      expect(result.type).toBe(PROVIDER_ERROR_TYPES.NETWORK);
      expect(result.isRetryable).toBe(true);
    });

    it('should handle unknown errors', () => {
      const result = classifyError('unknown error', 'test');
      
      expect(result.type).toBe(PROVIDER_ERROR_TYPES.UNKNOWN);
      expect(result.isRetryable).toBe(false);
    });
  });

  describe('isRetryableError', () => {
    it('should return true for retryable errors', () => {
      const error = { type: 'rate_limit_error', message: 'Rate limit', statusCode: 429, isRetryable: true, provider: 'test' };
      expect(isRetryableError(error as any)).toBe(true);
    });

    it('should return false for non-retryable errors', () => {
      const error = { type: 'authentication_error', message: 'Invalid key', statusCode: 401, isRetryable: false, provider: 'test' };
      expect(isRetryableError(error as any)).toBe(false);
    });
  });

  describe('getErrorMessage', () => {
    it('should return the error message', () => {
      const error = { type: 'rate_limit_error', message: 'Rate limit exceeded', statusCode: 429, isRetryable: true, provider: 'test' };
      expect(getErrorMessage(error as any)).toBe('Rate limit exceeded');
    });
  });

  describe('getErrorType', () => {
    it('should return the error type', () => {
      const error = { type: 'authentication_error', message: 'Invalid key', statusCode: 401, isRetryable: false, provider: 'test' };
      expect(getErrorType(error as any)).toBe('authentication_error');
    });
  });
});

describe('OpenAICompatibleProvider', () => {
  const mockConfig: ProviderConfig = {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || 'test-key',
    defaultModel: 'gpt-4o',
    timeout: 30000,
  };

  describe('constructor', () => {
    it('should extract provider name from base URL', () => {
      const provider = new OpenAICompatibleProvider({
        ...mockConfig,
        baseUrl: 'https://api.nvidia.com/v1',
      });
      expect(provider.name).toBe('nvidia');
    });

    it('should use default timeout', () => {
      const provider = new OpenAICompatibleProvider(mockConfig);
      const config = provider.getConfig();
      expect(config.timeout).toBe(30000);
    });
  });

  describe('healthcheck', () => {
    it('should return false when API key is invalid', async () => {
      const provider = new OpenAICompatibleProvider({
        ...mockConfig,
        apiKey: 'invalid-key',
      });
      const result = await provider.healthcheck();
      expect(result).toBe(false);
    });
  });
});

describe('AnthropicProvider', () => {
  const mockConfig: ProviderConfig = {
    baseUrl: '',
    apiKey: process.env.ANTHROPIC_API_KEY || 'test-key',
    defaultModel: 'claude-3-haiku-20240307',
    timeout: 30000,
  };

  describe('constructor', () => {
    it('should set name to anthropic', () => {
      const provider = new AnthropicProvider(mockConfig);
      expect(provider.name).toBe('anthropic');
    });
  });

  describe('listModels', () => {
    it('should return list of known Anthropic models', async () => {
      const provider = new AnthropicProvider(mockConfig);
      const result = await provider.listModels();
      
      expect(result.object).toBe('list');
      expect(result.data).toBeInstanceOf(Array);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].id).toContain('claude');
    });
  });

  describe('healthcheck', () => {
    it('should return false when API key is invalid', async () => {
      const provider = new AnthropicProvider({
        ...mockConfig,
        apiKey: 'invalid-key',
      });
      const result = await provider.healthcheck();
      expect(result).toBe(false);
    });
  });
});
