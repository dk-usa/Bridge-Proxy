import { describe, it, expect } from 'vitest';
import type {
  RoutingStrategy,
  Deployment,
  RoutingContext,
  CooldownConfig,
} from '../../../src/routing/types.js';

describe('Routing Types', () => {
  describe('RoutingStrategy type', () => {
    it('should accept simple-shuffle strategy name', () => {
      const strategy: RoutingStrategy = 'simple-shuffle';
      expect(strategy).toBe('simple-shuffle');
    });

    it('should accept least-busy strategy name', () => {
      const strategy: RoutingStrategy = 'least-busy';
      expect(strategy).toBe('least-busy');
    });

    it('should accept latency-based strategy name', () => {
      const strategy: RoutingStrategy = 'latency-based';
      expect(strategy).toBe('latency-based');
    });

    it('should accept cost-based strategy name', () => {
      const strategy: RoutingStrategy = 'cost-based';
      expect(strategy).toBe('cost-based');
    });

    it('should accept failover strategy name', () => {
      const strategy: RoutingStrategy = 'failover';
      expect(strategy).toBe('failover');
    });
  });

  describe('Deployment interface', () => {
    it('should have required fields', () => {
      const deployment: Deployment = {
        id: 'deploy-1',
        modelName: 'gpt-4o',
        providerId: 'openai-primary',
        providerModel: 'gpt-4o-2024-05-13',
        rpm: 60,
        tpm: 100000,
        weight: 1,
        order: 1,
        cooldownUntil: null,
        avgLatencyMs: 150,
        inputCostPerMillion: 5.0,
      };

      expect(deployment.id).toBe('deploy-1');
      expect(deployment.modelName).toBe('gpt-4o');
      expect(deployment.providerId).toBe('openai-primary');
      expect(deployment.providerModel).toBe('gpt-4o-2024-05-13');
      expect(deployment.rpm).toBe(60);
      expect(deployment.tpm).toBe(100000);
      expect(deployment.weight).toBe(1);
      expect(deployment.order).toBe(1);
      expect(deployment.cooldownUntil).toBeNull();
      expect(deployment.avgLatencyMs).toBe(150);
      expect(deployment.inputCostPerMillion).toBe(5.0);
    });

    it('should allow null values for optional fields', () => {
      const deployment: Deployment = {
        id: 'deploy-2',
        modelName: 'claude-3-5-sonnet',
        providerId: 'anthropic-primary',
        providerModel: 'claude-3-5-sonnet-20240620',
        rpm: null,
        tpm: null,
        weight: 2,
        order: 1,
        cooldownUntil: null,
        avgLatencyMs: null,
        inputCostPerMillion: null,
      };

      expect(deployment.rpm).toBeNull();
      expect(deployment.tpm).toBeNull();
      expect(deployment.avgLatencyMs).toBeNull();
      expect(deployment.inputCostPerMillion).toBeNull();
    });

    it('should allow Date for cooldownUntil', () => {
      const cooldownDate = new Date('2026-03-28T12:00:00Z');
      const deployment: Deployment = {
        id: 'deploy-3',
        modelName: 'gpt-4o',
        providerId: 'openai-primary',
        providerModel: 'gpt-4o-2024-05-13',
        rpm: 60,
        tpm: 100000,
        weight: 1,
        order: 1,
        cooldownUntil: cooldownDate,
        avgLatencyMs: 150,
        inputCostPerMillion: 5.0,
      };

      expect(deployment.cooldownUntil).toBeInstanceOf(Date);
      expect(deployment.cooldownUntil?.toISOString()).toBe('2026-03-28T12:00:00.000Z');
    });
  });

  describe('RoutingContext interface', () => {
    it('should have retryDepth and maxRetries fields', () => {
      const context: RoutingContext = {
        model: 'gpt-4o',
        estimatedTokens: 1000,
        strategy: 'simple-shuffle',
        retryDepth: 0,
        maxRetries: 2,
      };

      expect(context.model).toBe('gpt-4o');
      expect(context.estimatedTokens).toBe(1000);
      expect(context.strategy).toBe('simple-shuffle');
      expect(context.retryDepth).toBe(0);
      expect(context.maxRetries).toBe(2);
    });

    it('should accept different strategy types', () => {
      const context: RoutingContext = {
        model: 'claude-3-5-sonnet',
        estimatedTokens: 500,
        strategy: 'least-busy',
        retryDepth: 1,
        maxRetries: 3,
      };

      expect(context.strategy).toBe('least-busy');
      expect(context.retryDepth).toBe(1);
      expect(context.maxRetries).toBe(3);
    });
  });

  describe('CooldownConfig interface', () => {
    it('should have allowedFails and cooldownTimeSeconds fields', () => {
      const config: CooldownConfig = {
        allowedFails: 3,
        cooldownTimeSeconds: 30,
      };

      expect(config.allowedFails).toBe(3);
      expect(config.cooldownTimeSeconds).toBe(30);
    });

    it('should allow custom values', () => {
      const config: CooldownConfig = {
        allowedFails: 5,
        cooldownTimeSeconds: 60,
      };

      expect(config.allowedFails).toBe(5);
      expect(config.cooldownTimeSeconds).toBe(60);
    });
  });
});
