/**
 * Unit tests for dynamic provider registration from YAML config.
 * Tests registerProvidersFromConfig function with various YAML configurations.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Create a shared state for the mock that can be reset
const createMockProviderRegistry = () => {
  const providers = new Map<string, object>();
  const addMock = vi.fn((provider: object) => {
    const p = provider as { id: string };
    providers.set(p.id, provider);
    return provider;
  });
  const getByIdMock = vi.fn((id: string) => providers.get(id));
  const updateMock = vi.fn((id: string, updates: object) => {
    const existing = providers.get(id);
    if (existing) {
      const updated = { ...existing, ...updates };
      providers.set(id, updated);
      return updated;
    }
    return undefined;
  });
  return {
    providers,
    mocks: {
      providerRegistry: {
        add: addMock,
        getById: getByIdMock,
        update: updateMock,
      },
      getProviderType: vi.fn((model: string) => {
        const slashIndex = model.indexOf('/');
        const prefix = slashIndex === -1 ? '' : model.slice(0, slashIndex + 1);
        const providerTypes: Record<string, string> = {
          'openai/': 'openai-compatible',
          'azure/': 'azure',
          'anthropic/': 'anthropic',
          'google/': 'google',
          'cohere/': 'cohere',
          'mistral/': 'mistral',
          'bedrock/': 'bedrock',
          'vertex/': 'vertex',
          'deepseek/': 'openai-compatible',
          'groq/': 'openai-compatible',
          'together/': 'openai-compatible',
          'ollama/': 'openai-compatible',
        };
        return prefix in providerTypes ? providerTypes[prefix] : 'openai-compatible';
      }),
    },
  };
};

let mockState: ReturnType<typeof createMockProviderRegistry>;

// Mock provider-registry before importing dynamic-provider
vi.mock('../../../src/services/provider-registry.js', () => {
  // Return a factory that uses the current mockState
  return {
    get providerRegistry() {
      return mockState.mocks.providerRegistry;
    },
    get getProviderType() {
      return mockState.mocks.getProviderType;
    },
    Provider: {},
  };
});

describe('dynamic-provider', () => {
  beforeEach(() => {
    mockState = createMockProviderRegistry();
  });

  describe('registerProvidersFromConfig', () => {
    it('should create providers from model_list', async () => {
      const { registerProvidersFromConfig } =
        await import('../../../src/config/dynamic-provider.js');

      const config = {
        model_list: [
          {
            model_name: 'gpt-4o',
            litellm_params: {
              model: 'openai/gpt-4o',
              api_key: 'sk-test-key',
              api_base: 'https://api.openai.com/v1',
            },
          },
        ],
        general_settings: {
          master_key: 'admin-secret',
        },
      };

      registerProvidersFromConfig(config as any);

      expect(mockState.mocks.providerRegistry.add).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'gpt-4o',
          type: 'openai-compatible',
          baseUrl: 'https://api.openai.com/v1',
          apiKey: 'sk-test-key',
          models: ['openai/gpt-4o'],
          enabled: true,
        })
      );
    });

    it('should derive provider IDs from model_name', async () => {
      const { registerProvidersFromConfig } =
        await import('../../../src/config/dynamic-provider.js');

      const config = {
        model_list: [
          {
            model_name: 'my-custom-model',
            litellm_params: {
              model: 'groq/llama-3.1-70b',
              api_key: 'test-key',
            },
          },
        ],
        general_settings: {
          master_key: 'admin-secret',
        },
      };

      registerProvidersFromConfig(config as any);

      expect(mockState.mocks.providerRegistry.add).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'my-custom-model',
        })
      );
    });

    it('should use apiKey from litellm_params for provider config', async () => {
      const { registerProvidersFromConfig } =
        await import('../../../src/config/dynamic-provider.js');

      const config = {
        model_list: [
          {
            model_name: 'claude-model',
            litellm_params: {
              model: 'anthropic/claude-3-5-sonnet',
              api_key: 'sk-ant-test',
              api_base: 'https://api.anthropic.com',
            },
          },
        ],
        general_settings: {
          master_key: 'admin-secret',
        },
      };

      registerProvidersFromConfig(config as any);

      expect(mockState.mocks.providerRegistry.add).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'sk-ant-test',
        })
      );
    });

    it('should update existing provider when model_name already exists', async () => {
      const { registerProvidersFromConfig } =
        await import('../../../src/config/dynamic-provider.js');

      // First registration
      const config1 = {
        model_list: [
          {
            model_name: 'gpt-4o',
            litellm_params: {
              model: 'openai/gpt-4o',
              api_key: 'old-key',
            },
          },
        ],
        general_settings: {
          master_key: 'admin-secret',
        },
      };

      registerProvidersFromConfig(config1 as any);

      // Manually add to providers map to simulate existing provider
      mockState.providers.set('gpt-4o', { id: 'gpt-4o', apiKey: 'old-key' });

      // Clear mock call counts but keep the providers map
      mockState.mocks.providerRegistry.add.mockClear();

      // Second registration with same model_name (should update)
      const config2 = {
        model_list: [
          {
            model_name: 'gpt-4o',
            litellm_params: {
              model: 'openai/gpt-4o',
              api_key: 'new-key',
            },
          },
        ],
        general_settings: {
          master_key: 'admin-secret',
        },
      };

      registerProvidersFromConfig(config2 as any);

      // Should call update for existing provider
      expect(mockState.mocks.providerRegistry.update).toHaveBeenCalled();
    });

    it('should handle empty model_list without error', async () => {
      const { registerProvidersFromConfig } =
        await import('../../../src/config/dynamic-provider.js');

      const config = {
        model_list: [],
        general_settings: {
          master_key: 'admin-secret',
        },
      };

      // Should not throw
      expect(() => registerProvidersFromConfig(config as any)).not.toThrow();
      expect(mockState.mocks.providerRegistry.add).not.toHaveBeenCalled();
    });

    it('should use default timeout when not specified', async () => {
      const { registerProvidersFromConfig } =
        await import('../../../src/config/dynamic-provider.js');

      const config = {
        model_list: [
          {
            model_name: 'test-model',
            litellm_params: {
              model: 'openai/gpt-4o',
              api_key: 'test-key',
              // No timeout specified
            },
          },
        ],
        general_settings: {
          master_key: 'admin-secret',
        },
      };

      registerProvidersFromConfig(config as any);

      expect(mockState.mocks.providerRegistry.add).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMs: 60000, // Default
        })
      );
    });

    it('should use custom timeout from litellm_params', async () => {
      const { registerProvidersFromConfig } =
        await import('../../../src/config/dynamic-provider.js');

      const config = {
        model_list: [
          {
            model_name: 'test-model',
            litellm_params: {
              model: 'openai/gpt-4o',
              api_key: 'test-key',
              timeout: 30000,
            },
          },
        ],
        general_settings: {
          master_key: 'admin-secret',
        },
      };

      registerProvidersFromConfig(config as any);

      expect(mockState.mocks.providerRegistry.add).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMs: 30000,
        })
      );
    });

    it('should handle missing api_base gracefully', async () => {
      const { registerProvidersFromConfig } =
        await import('../../../src/config/dynamic-provider.js');

      const config = {
        model_list: [
          {
            model_name: 'test-model',
            litellm_params: {
              model: 'ollama/llama3',
              api_key: '',
              // No api_base
            },
          },
        ],
        general_settings: {
          master_key: 'admin-secret',
        },
      };

      registerProvidersFromConfig(config as any);

      expect(mockState.mocks.providerRegistry.add).toHaveBeenCalledWith(
        expect.objectContaining({
          baseUrl: '',
        })
      );
    });
  });
});
