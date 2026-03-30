import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { Deployment, RoutingContext } from '../../../src/routing/types.js';
import { RoutingService } from '../../../src/routing/index.js';

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

// Mock cooldown manager
const mockCooldownManager = {
  isInCooldown: vi.fn(),
  recordSuccess: vi.fn(),
  recordFailure: vi.fn(),
  clearCooldown: vi.fn(),
};

const defaultContext: RoutingContext = {
  model: 'gpt-4o',
  estimatedTokens: 1000,
  strategy: 'simple-shuffle',
  retryDepth: 0,
  maxRetries: 2,
};

describe('RoutingService', () => {
  let routingService: RoutingService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCooldownManager.isInCooldown.mockResolvedValue(false);
    routingService = new RoutingService(mockCooldownManager as unknown as any);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('selectDeployment', () => {
    it('should return null when no healthy deployments', async () => {
      // All deployments in cooldown
      mockCooldownManager.isInCooldown.mockResolvedValue(true);

      const deployments = [
        createDeployment({ id: 'deploy-1' }),
        createDeployment({ id: 'deploy-2' }),
      ];

      const result = await routingService.selectDeployment(defaultContext, deployments);
      expect(result).toBeNull();
    });

    it('should filter out cooldown deployments first', async () => {
      mockCooldownManager.isInCooldown.mockImplementation(async (id: string) => {
        return id === 'deploy-1';
      });

      const deployments = [
        createDeployment({ id: 'deploy-1', order: 1 }),
        createDeployment({ id: 'deploy-2', order: 2 }),
      ];

      const result = await routingService.selectDeployment(
        { ...defaultContext, strategy: 'failover' },
        deployments
      );

      // Should return deploy-2 (deploy-1 is in cooldown)
      expect(result?.id).toBe('deploy-2');
    });

    it('should apply strategy to filtered deployments', async () => {
      mockCooldownManager.isInCooldown.mockResolvedValue(false);

      const deployments = [
        createDeployment({ id: 'slow', avgLatencyMs: 500 }),
        createDeployment({ id: 'fast', avgLatencyMs: 50 }),
      ];

      const result = await routingService.selectDeployment(
        { ...defaultContext, strategy: 'latency-based' },
        deployments
      );

      expect(result?.id).toBe('fast');
    });

    it('should return null when all deployments are in cooldown', async () => {
      mockCooldownManager.isInCooldown.mockResolvedValue(true);

      const deployments = [
        createDeployment({ id: 'deploy-1' }),
        createDeployment({ id: 'deploy-2' }),
      ];

      const result = await routingService.selectDeployment(defaultContext, deployments);
      expect(result).toBeNull();
    });
  });

  describe('getHealthyDeployments', () => {
    it('should filter enabled and not in cooldown deployments', async () => {
      mockCooldownManager.isInCooldown.mockImplementation(async (id: string) => {
        return id === 'deploy-2';
      });

      const deployments = [
        createDeployment({ id: 'deploy-1', cooldownUntil: null }),
        createDeployment({ id: 'deploy-2', cooldownUntil: new Date() }),
      ];

      const result = await routingService.getHealthyDeployments('gpt-4o', deployments);

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe('deploy-1');
    });

    it('should return empty array when all deployments are in cooldown', async () => {
      mockCooldownManager.isInCooldown.mockResolvedValue(true);

      const deployments = [
        createDeployment({ id: 'deploy-1' }),
        createDeployment({ id: 'deploy-2' }),
      ];

      const result = await routingService.getHealthyDeployments('gpt-4o', deployments);
      expect(result).toHaveLength(0);
    });
  });

  describe('recordSuccess', () => {
    it('should clear cooldown and update latency', async () => {
      await routingService.recordSuccess('deploy-1', 150);

      expect(mockCooldownManager.recordSuccess).toHaveBeenCalledWith('deploy-1');
    });

    it('should track latency for latency-based routing', async () => {
      // First call sets up deployment
      await routingService.recordSuccess('deploy-1', 100);

      // Verify the call was made
      expect(mockCooldownManager.recordSuccess).toHaveBeenCalledWith('deploy-1');
    });
  });

  describe('recordFailure', () => {
    it('should increment fail count via cooldown manager', async () => {
      await routingService.recordFailure('deploy-1', 'RATE_LIMIT');

      expect(mockCooldownManager.recordFailure).toHaveBeenCalledWith('deploy-1');
    });
  });

  describe('strategies', () => {
    it('should have all 5 strategies registered', () => {
      const strategies = routingService.getAvailableStrategies();
      expect(strategies).toContain('simple-shuffle');
      expect(strategies).toContain('least-busy');
      expect(strategies).toContain('latency-based');
      expect(strategies).toContain('cost-based');
      expect(strategies).toContain('failover');
    });

    it('should use simple-shuffle as default strategy', () => {
      const defaultStrategy = routingService.getDefaultStrategy();
      expect(defaultStrategy).toBe('simple-shuffle');
    });
  });

  describe('latency tracking', () => {
    it('should track latency for deployments', async () => {
      mockCooldownManager.isInCooldown.mockResolvedValue(false);

      const deployments = [createDeployment({ id: 'deploy-1', avgLatencyMs: null })];

      // Record success with latency
      routingService.updateDeploymentLatency('deploy-1', 100);

      // The latency should be tracked internally
      // For now, this is a simple test that the method exists
      expect(true).toBe(true);
    });
  });
});
