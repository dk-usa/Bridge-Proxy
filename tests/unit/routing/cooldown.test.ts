import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CooldownManager } from '../../../src/routing/cooldown.js';

// Mock Redis for unit tests
const mockRedis = {
  get: vi.fn(),
  set: vi.fn(),
  setex: vi.fn(),
  incr: vi.fn(),
  del: vi.fn(),
  keys: vi.fn(),
};

describe('CooldownManager', () => {
  let cooldownManager: CooldownManager;

  beforeEach(() => {
    vi.clearAllMocks();
    cooldownManager = new CooldownManager(mockRedis as unknown as any, {
      allowedFails: 3,
      cooldownTimeSeconds: 30,
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('recordFailure', () => {
    it('should increment failure count for deployment', async () => {
      mockRedis.incr.mockResolvedValue(1);
      mockRedis.get.mockResolvedValue(null);

      await cooldownManager.recordFailure('deploy-1');

      expect(mockRedis.incr).toHaveBeenCalledWith('deploy:fails:deploy-1');
    });

    it('should trigger cooldown after allowedFails failures', async () => {
      mockRedis.incr.mockResolvedValue(3); // Hit the threshold
      mockRedis.get.mockResolvedValue(null);

      await cooldownManager.recordFailure('deploy-1');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'deploy:cooldown:deploy-1',
        30,
        expect.any(String)
      );
    });

    it('should not trigger cooldown before allowedFails', async () => {
      mockRedis.incr.mockResolvedValue(2); // Below threshold
      mockRedis.get.mockResolvedValue(null);

      await cooldownManager.recordFailure('deploy-1');

      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should clear failure count after cooldown triggered', async () => {
      mockRedis.incr.mockResolvedValue(3);
      mockRedis.get.mockResolvedValue(null);

      await cooldownManager.recordFailure('deploy-1');

      expect(mockRedis.del).toHaveBeenCalledWith('deploy:fails:deploy-1');
    });
  });

  describe('isInCooldown', () => {
    it('should return true when deployment is in cooldown', async () => {
      mockRedis.get.mockResolvedValue('2026-03-28T12:00:00.000Z');

      const result = await cooldownManager.isInCooldown('deploy-1');

      expect(result).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith('deploy:cooldown:deploy-1');
    });

    it('should return false when deployment is not in cooldown', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cooldownManager.isInCooldown('deploy-1');

      expect(result).toBe(false);
    });
  });

  describe('clearCooldown', () => {
    it('should delete cooldown key', async () => {
      await cooldownManager.clearCooldown('deploy-1');

      expect(mockRedis.del).toHaveBeenCalledWith('deploy:cooldown:deploy-1');
      expect(mockRedis.del).toHaveBeenCalledWith('deploy:fails:deploy-1');
    });
  });

  describe('recordSuccess', () => {
    it('should clear failure count on success', async () => {
      await cooldownManager.recordSuccess('deploy-1');

      expect(mockRedis.del).toHaveBeenCalledWith('deploy:fails:deploy-1');
    });

    it('should clear cooldown on success', async () => {
      await cooldownManager.recordSuccess('deploy-1');

      expect(mockRedis.del).toHaveBeenCalledWith('deploy:cooldown:deploy-1');
    });
  });

  describe('getFailureCount', () => {
    it('should return current failure count', async () => {
      mockRedis.get.mockResolvedValue('5');

      const result = await cooldownManager.getFailureCount('deploy-1');

      expect(result).toBe(5);
      expect(mockRedis.get).toHaveBeenCalledWith('deploy:fails:deploy-1');
    });

    it('should return 0 when no failures recorded', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cooldownManager.getFailureCount('deploy-1');

      expect(result).toBe(0);
    });
  });

  describe('configurable thresholds', () => {
    it('should use custom allowedFails value', async () => {
      const customManager = new CooldownManager(mockRedis as unknown as any, {
        allowedFails: 5,
        cooldownTimeSeconds: 60,
      });

      mockRedis.incr.mockResolvedValue(3); // Below custom threshold
      mockRedis.get.mockResolvedValue(null);

      await customManager.recordFailure('deploy-1');

      // Should not trigger cooldown at 3 failures when threshold is 5
      expect(mockRedis.setex).not.toHaveBeenCalled();
    });

    it('should use custom cooldownTimeSeconds value', async () => {
      const customManager = new CooldownManager(mockRedis as unknown as any, {
        allowedFails: 2,
        cooldownTimeSeconds: 60,
      });

      mockRedis.incr.mockResolvedValue(2); // Hit threshold
      mockRedis.get.mockResolvedValue(null);

      await customManager.recordFailure('deploy-1');

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'deploy:cooldown:deploy-1',
        60, // Custom cooldown time
        expect.any(String)
      );
    });
  });
});
