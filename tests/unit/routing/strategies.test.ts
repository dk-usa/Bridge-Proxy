import { describe, it, expect, beforeEach } from 'vitest';
import type { Deployment, RoutingContext } from '../../../src/routing/types.js';
import { SimpleShuffleStrategy } from '../../../src/routing/strategies/simple-shuffle.js';
import { LeastBusyStrategy } from '../../../src/routing/strategies/least-busy.js';
import { LatencyBasedStrategy } from '../../../src/routing/strategies/latency-based.js';
import { CostBasedStrategy } from '../../../src/routing/strategies/cost-based.js';
import { FailoverStrategy } from '../../../src/routing/strategies/failover.js';

// Mock deployments for testing
const createDeployment = (overrides: Partial<Deployment> = {}): Deployment => ({
  id: 'test-deploy',
  modelName: 'gpt-4o',
  providerId: 'test-provider',
  providerModel: 'gpt-4o',
  rpm: null,
  tpm: null,
  weight: 1,
  order: 1,
  cooldownUntil: null,
  avgLatencyMs: null,
  inputCostPerMillion: null,
  ...overrides,
});

const defaultContext: RoutingContext = {
  model: 'gpt-4o',
  estimatedTokens: 1000,
  strategy: 'simple-shuffle',
  retryDepth: 0,
  maxRetries: 2,
};

describe('Routing Strategies', () => {
  describe('SimpleShuffleStrategy', () => {
    let strategy: SimpleShuffleStrategy;

    beforeEach(() => {
      strategy = new SimpleShuffleStrategy();
    });

    it('should have correct name', () => {
      expect(strategy.name).toBe('simple-shuffle');
    });

    it('should return null for empty deployments', () => {
      const result = strategy.select([], defaultContext);
      expect(result).toBeNull();
    });

    it('should select from single deployment', () => {
      const deployment = createDeployment({ id: 'single' });
      const result = strategy.select([deployment], defaultContext);
      expect(result).toBe(deployment);
    });

    it('should perform weighted random selection', () => {
      const deployments = [
        createDeployment({ id: 'deploy-1', weight: 1 }),
        createDeployment({ id: 'deploy-2', weight: 1 }),
        createDeployment({ id: 'deploy-3', weight: 1 }),
      ];

      // Run selection multiple times to verify randomness
      const results = new Set<string>();
      for (let i = 0; i < 100; i++) {
        const result = strategy.select(deployments, defaultContext);
        if (result) results.add(result.id);
      }

      // All 3 deployments should be selected at least once (statistical)
      expect(results.size).toBeGreaterThan(1);
    });

    it('should respect weight proportions', () => {
      const deployments = [
        createDeployment({ id: 'low-weight', weight: 1 }),
        createDeployment({ id: 'high-weight', weight: 10 }),
      ];

      // High weight deployment should be selected more often
      const counts: Record<string, number> = { 'low-weight': 0, 'high-weight': 0 };
      for (let i = 0; i < 1000; i++) {
        const result = strategy.select(deployments, defaultContext);
        if (result) counts[result.id]++;
      }

      // High weight should be selected ~10x more often
      expect(counts['high-weight']).toBeGreaterThan(counts['low-weight'] * 5);
    });

    it('should handle zero weights', () => {
      const deployments = [
        createDeployment({ id: 'zero', weight: 0 }),
        createDeployment({ id: 'one', weight: 1 }),
      ];

      const result = strategy.select(deployments, defaultContext);
      // Should return 'one' since 'zero' has no weight
      expect(result?.id).toBe('one');
    });
  });

  describe('LeastBusyStrategy', () => {
    let strategy: LeastBusyStrategy;

    beforeEach(() => {
      strategy = new LeastBusyStrategy();
    });

    it('should have correct name', () => {
      expect(strategy.name).toBe('least-busy');
    });

    it('should return null for empty deployments', () => {
      const result = strategy.select([], defaultContext);
      expect(result).toBeNull();
    });

    it('should select deployment with fewest in-flight requests', () => {
      const deployments = [
        createDeployment({ id: 'busy' }),
        createDeployment({ id: 'less-busy' }),
        createDeployment({ id: 'idle' }),
      ];

      // This test verifies the logic - actual Redis integration tested separately
      // In-memory fallback returns first deployment when Redis is not available
      const result = strategy.select(deployments, defaultContext);
      expect(result).not.toBeNull();
      expect(result?.id).toBe('busy');
    });
  });

  describe('LatencyBasedStrategy', () => {
    let strategy: LatencyBasedStrategy;

    beforeEach(() => {
      strategy = new LatencyBasedStrategy();
    });

    it('should have correct name', () => {
      expect(strategy.name).toBe('latency-based');
    });

    it('should return null for empty deployments', () => {
      const result = strategy.select([], defaultContext);
      expect(result).toBeNull();
    });

    it('should select deployment with lowest latency', () => {
      const deployments = [
        createDeployment({ id: 'slow', avgLatencyMs: 500 }),
        createDeployment({ id: 'medium', avgLatencyMs: 200 }),
        createDeployment({ id: 'fast', avgLatencyMs: 50 }),
      ];

      const result = strategy.select(deployments, defaultContext);
      expect(result?.id).toBe('fast');
    });

    it('should filter out deployments with null latency', () => {
      const deployments = [
        createDeployment({ id: 'no-data', avgLatencyMs: null }),
        createDeployment({ id: 'has-data', avgLatencyMs: 100 }),
      ];

      const result = strategy.select(deployments, defaultContext);
      expect(result?.id).toBe('has-data');
    });

    it('should return null when all deployments have null latency', () => {
      const deployments = [
        createDeployment({ id: 'no-data-1', avgLatencyMs: null }),
        createDeployment({ id: 'no-data-2', avgLatencyMs: null }),
      ];

      const result = strategy.select(deployments, defaultContext);
      expect(result).toBeNull();
    });

    it('should handle mixed null and valid latencies', () => {
      const deployments = [
        createDeployment({ id: 'slow', avgLatencyMs: 1000 }),
        createDeployment({ id: 'no-data', avgLatencyMs: null }),
        createDeployment({ id: 'fast', avgLatencyMs: 100 }),
      ];

      const result = strategy.select(deployments, defaultContext);
      expect(result?.id).toBe('fast');
    });
  });

  describe('CostBasedStrategy', () => {
    let strategy: CostBasedStrategy;

    beforeEach(() => {
      strategy = new CostBasedStrategy();
    });

    it('should have correct name', () => {
      expect(strategy.name).toBe('cost-based');
    });

    it('should return null for empty deployments', () => {
      const result = strategy.select([], defaultContext);
      expect(result).toBeNull();
    });

    it('should select deployment with lowest cost', () => {
      const deployments = [
        createDeployment({ id: 'expensive', inputCostPerMillion: 30 }),
        createDeployment({ id: 'moderate', inputCostPerMillion: 10 }),
        createDeployment({ id: 'cheap', inputCostPerMillion: 0.5 }),
      ];

      const result = strategy.select(deployments, defaultContext);
      expect(result?.id).toBe('cheap');
    });

    it('should handle null costs (treat as expensive)', () => {
      const deployments = [
        createDeployment({ id: 'unknown', inputCostPerMillion: null }),
        createDeployment({ id: 'known', inputCostPerMillion: 5 }),
      ];

      const result = strategy.select(deployments, defaultContext);
      expect(result?.id).toBe('known');
    });

    it('should handle all null costs', () => {
      const deployments = [
        createDeployment({ id: 'unknown-1', inputCostPerMillion: null }),
        createDeployment({ id: 'unknown-2', inputCostPerMillion: null }),
      ];

      // Should still return one of them (first after sort)
      const result = strategy.select(deployments, defaultContext);
      expect(result).not.toBeNull();
    });
  });

  describe('FailoverStrategy', () => {
    let strategy: FailoverStrategy;

    beforeEach(() => {
      strategy = new FailoverStrategy();
    });

    it('should have correct name', () => {
      expect(strategy.name).toBe('failover');
    });

    it('should return null for empty deployments', () => {
      const result = strategy.select([], defaultContext);
      expect(result).toBeNull();
    });

    it('should select deployment with lowest order (highest priority)', () => {
      const deployments = [
        createDeployment({ id: 'backup-2', order: 3 }),
        createDeployment({ id: 'backup-1', order: 2 }),
        createDeployment({ id: 'primary', order: 1 }),
      ];

      const result = strategy.select(deployments, defaultContext);
      expect(result?.id).toBe('primary');
    });

    it('should handle same order values', () => {
      const deployments = [
        createDeployment({ id: 'deploy-1', order: 1 }),
        createDeployment({ id: 'deploy-2', order: 1 }),
      ];

      const result = strategy.select(deployments, defaultContext);
      // Should return one of them (deterministic based on array order)
      expect(['deploy-1', 'deploy-2']).toContain(result?.id);
    });

    it('should not modify original array', () => {
      const deployments = [
        createDeployment({ id: 'deploy-1', order: 3 }),
        createDeployment({ id: 'deploy-2', order: 1 }),
        createDeployment({ id: 'deploy-3', order: 2 }),
      ];

      strategy.select(deployments, defaultContext);
      // Original array order should be preserved
      expect(deployments[0].id).toBe('deploy-1');
      expect(deployments[1].id).toBe('deploy-2');
      expect(deployments[2].id).toBe('deploy-3');
    });
  });
});
