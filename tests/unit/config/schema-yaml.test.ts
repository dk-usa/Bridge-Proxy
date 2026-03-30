import { describe, it, expect } from 'vitest';
import {
  YamlConfigSchema,
  ModelListItemSchema,
  RouterSettingsSchema,
  LitellmParamsSchema,
  GeneralSettingsSchema,
} from '../../../src/config/schema-yaml.js';

describe('YamlConfigSchema', () => {
  describe('valid config', () => {
    it('should validate config with model_list and all required fields', () => {
      const config = {
        model_list: [
          {
            model_name: 'gpt-4o',
            litellm_params: {
              model: 'openai/gpt-4o',
              api_key: 'os.environ/OPENAI_API_KEY',
            },
          },
        ],
        general_settings: {
          master_key: 'test-master-key',
        },
      };

      const result = YamlConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });

    it('should validate config with multiple providers', () => {
      const config = {
        model_list: [
          {
            model_name: 'gpt-4o',
            litellm_params: {
              model: 'openai/gpt-4o',
              api_key: 'os.environ/OPENAI_API_KEY',
            },
          },
          {
            model_name: 'claude-3-5-sonnet',
            litellm_params: {
              model: 'anthropic/claude-3-5-sonnet-20241022',
              api_key: 'os.environ/ANTHROPIC_API_KEY',
            },
          },
        ],
        general_settings: {
          master_key: 'test-master-key',
        },
        router_settings: {
          routing_strategy: 'simple-shuffle',
        },
      };

      const result = YamlConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
    });
  });

  describe('missing required fields', () => {
    it('should fail validation when model_list is missing', () => {
      const config = {
        general_settings: {
          master_key: 'test-master-key',
        },
      };

      const result = YamlConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path.includes('model_list'))).toBe(true);
      }
    });

    it('should fail validation when general_settings is missing', () => {
      const config = {
        model_list: [
          {
            model_name: 'gpt-4o',
            litellm_params: {
              model: 'openai/gpt-4o',
            },
          },
        ],
      };

      const result = YamlConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });
  });

  describe('router settings with default values', () => {
    it('should apply default values for router_settings', () => {
      const config = {
        model_list: [
          {
            model_name: 'gpt-4o',
            litellm_params: {
              model: 'openai/gpt-4o',
            },
          },
        ],
        general_settings: {
          master_key: 'test-master-key',
        },
        router_settings: {
          routing_strategy: 'simple-shuffle',
        },
      };

      const result = YamlConfigSchema.safeParse(config);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.router_settings?.num_retries).toBe(2);
        expect(result.data.router_settings?.timeout).toBe(30);
        expect(result.data.router_settings?.allowed_fails).toBe(3);
        expect(result.data.router_settings?.cooldown_time).toBe(30);
      }
    });
  });

  describe('routing_strategy validation', () => {
    it('should fail validation for invalid routing_strategy', () => {
      const config = {
        model_list: [
          {
            model_name: 'gpt-4o',
            litellm_params: {
              model: 'openai/gpt-4o',
            },
          },
        ],
        general_settings: {
          master_key: 'test-master-key',
        },
        router_settings: {
          routing_strategy: 'invalid-strategy',
        },
      };

      const result = YamlConfigSchema.safeParse(config);
      expect(result.success).toBe(false);
    });

    it('should validate all valid routing strategies', () => {
      const validStrategies = [
        'simple-shuffle',
        'least-busy',
        'latency-based-routing',
        'cost-based-routing',
        'failover',
      ];

      for (const strategy of validStrategies) {
        const config = {
          model_list: [
            {
              model_name: 'gpt-4o',
              litellm_params: { model: 'openai/gpt-4o' },
            },
          ],
          general_settings: { master_key: 'test-key' },
          router_settings: { routing_strategy: strategy },
        };

        const result = YamlConfigSchema.safeParse(config);
        expect(result.success).toBe(true);
      }
    });
  });
});

describe('ModelListItemSchema', () => {
  it('should validate model_name and litellm_params', () => {
    const item = {
      model_name: 'gpt-4o',
      litellm_params: {
        model: 'openai/gpt-4o',
      },
    };

    const result = ModelListItemSchema.safeParse(item);
    expect(result.success).toBe(true);
  });

  it('should fail when model_name is missing', () => {
    const item = {
      litellm_params: {
        model: 'openai/gpt-4o',
      },
    };

    const result = ModelListItemSchema.safeParse(item);
    expect(result.success).toBe(false);
  });
});

describe('LitellmParamsSchema', () => {
  it('should preserve os.environ/VAR_NAME syntax in api_key', () => {
    const params = {
      model: 'openai/gpt-4o',
      api_key: 'os.environ/OPENAI_API_KEY',
    };

    const result = LitellmParamsSchema.safeParse(params);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.api_key).toBe('os.environ/OPENAI_API_KEY');
    }
  });

  it('should validate optional fields', () => {
    const params = {
      model: 'openai/gpt-4o',
      api_key: 'test-key',
      api_base: 'https://api.openai.com/v1',
      rpm: 100,
      tpm: 10000,
      timeout: 30,
      max_retries: 3,
    };

    const result = LitellmParamsSchema.safeParse(params);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.rpm).toBe(100);
      expect(result.data.tpm).toBe(10000);
      expect(result.data.timeout).toBe(30);
      expect(result.data.max_retries).toBe(3);
    }
  });

  it('should require model field', () => {
    const params = {
      api_key: 'test-key',
    };

    const result = LitellmParamsSchema.safeParse(params);
    expect(result.success).toBe(false);
  });
});

describe('RouterSettingsSchema', () => {
  it('should apply all default values when only strategy is provided', () => {
    const settings = {
      routing_strategy: 'simple-shuffle',
    };

    const result = RouterSettingsSchema.safeParse(settings);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.num_retries).toBe(2);
      expect(result.data.timeout).toBe(30);
      expect(result.data.allowed_fails).toBe(3);
      expect(result.data.cooldown_time).toBe(30);
    }
  });
});

describe('GeneralSettingsSchema', () => {
  it('should validate with master_key only', () => {
    const settings = {
      master_key: 'test-master-key',
    };

    const result = GeneralSettingsSchema.safeParse(settings);
    expect(result.success).toBe(true);
  });

  it('should validate with optional database_url', () => {
    const settings = {
      master_key: 'test-master-key',
      database_url: 'sqlite:///path/to/db.sqlite',
    };

    const result = GeneralSettingsSchema.safeParse(settings);
    expect(result.success).toBe(true);
  });
});
