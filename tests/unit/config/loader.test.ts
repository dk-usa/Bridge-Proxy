import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import { loadYamlConfig, substituteEnvVars } from '../../../src/config/loader.js';

describe('loadYamlConfig', () => {
  const fixturePath = resolve(__dirname, '../../fixtures/yaml/config.test.yaml');
  const originalEnv = process.env;

  beforeEach(() => {
    // Set up mock env vars for testing
    process.env = {
      ...originalEnv,
      OPENAI_API_KEY: 'sk-test-openai-key',
      ANTHROPIC_API_KEY: 'sk-test-anthropic-key',
      MASTER_KEY: 'test-master-key-12345',
    };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('YAML file parsing', () => {
    it('should load and parse YAML file correctly', () => {
      const config = loadYamlConfig(fixturePath);

      expect(config).toBeDefined();
      expect(config.model_list).toHaveLength(2);
    });

    it('should parse model_list entries', () => {
      const config = loadYamlConfig(fixturePath);

      expect(config.model_list[0].model_name).toBe('gpt-4o');
      expect(config.model_list[0].litellm_params.model).toBe('openai/gpt-4o');
      expect(config.model_list[1].model_name).toBe('claude-3-5-sonnet');
    });
  });

  describe('environment variable substitution', () => {
    it('should substitute os.environ/VAR_NAME with process.env value', () => {
      const config = loadYamlConfig(fixturePath);

      expect(config.model_list[0].litellm_params.api_key).toBe('sk-test-openai-key');
      expect(config.model_list[1].litellm_params.api_key).toBe('sk-test-anthropic-key');
    });

    it('should substitute env vars in general_settings', () => {
      const config = loadYamlConfig(fixturePath);

      expect(config.general_settings.master_key).toBe('test-master-key-12345');
    });

    it('should return empty string for missing env var', () => {
      delete process.env.OPENAI_API_KEY;

      const config = loadYamlConfig(fixturePath);

      expect(config.model_list[0].litellm_params.api_key).toBe('');
    });
  });

  describe('config validation', () => {
    it('should validate config against YamlConfigSchema', () => {
      const config = loadYamlConfig(fixturePath);

      // Schema validation should pass
      expect(config.model_list).toBeDefined();
      expect(config.general_settings).toBeDefined();
      expect(config.general_settings.master_key).toBeDefined();
    });

    it('should throw ZodError for invalid config', () => {
      // Create a minimal invalid config fixture
      const invalidPath = resolve(__dirname, '../../fixtures/yaml/invalid.test.yaml');

      expect(() => loadYamlConfig(invalidPath)).toThrow();
    });
  });

  describe('error handling', () => {
    it('should throw error for non-existent file', () => {
      expect(() => loadYamlConfig('/nonexistent/path/to/config.yaml')).toThrow();
    });

    it('should throw error for invalid YAML syntax', () => {
      const invalidYamlPath = resolve(__dirname, '../../fixtures/yaml/invalid-syntax.test.yaml');

      expect(() => loadYamlConfig(invalidYamlPath)).toThrow();
    });
  });
});

describe('substituteEnvVars', () => {
  it('should substitute single env var', () => {
    process.env.TEST_VAR = 'test-value';

    const result = substituteEnvVars('os.environ/TEST_VAR');

    expect(result).toBe('test-value');
  });

  it('should substitute multiple env vars', () => {
    process.env.VAR1 = 'value1';
    process.env.VAR2 = 'value2';

    const result = substituteEnvVars('prefix-os.environ/VAR1-suffix-os.environ/VAR2-end');

    expect(result).toBe('prefix-value1-suffix-value2-end');
  });

  it('should return empty string for missing env var', () => {
    delete process.env.NONEXISTENT_VAR;

    const result = substituteEnvVars('os.environ/NONEXISTENT_VAR');

    expect(result).toBe('');
  });

  it('should preserve non-env content', () => {
    process.env.API_KEY = 'secret-key';

    const result = substituteEnvVars('https://api.example.com?key=os.environ/API_KEY');

    expect(result).toBe('https://api.example.com?key=secret-key');
  });
});
