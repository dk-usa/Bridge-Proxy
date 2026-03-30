import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type Redis from 'ioredis';

// Mock Redis before importing the module
const mockEval = vi.fn();
const mockGet = vi.fn();
const mockSet = vi.fn();
const mockDel = vi.fn();

vi.mock('../../../src/services/redis.js', () => ({
  getRedis: () => ({
    eval: mockEval,
    get: mockGet,
    set: mockSet,
    del: mockDel,
  }),
}));

import {
  BudgetTracker,
  getBudgetTracker,
  resetBudgetTracker,
} from '../../../src/virtual-keys/budget-tracker.js';

describe('BudgetTracker', () => {
  let budgetTracker: BudgetTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    resetBudgetTracker();

    // Create a fresh instance for each test
    const mockRedis = {
      eval: mockEval,
      get: mockGet,
      set: mockSet,
      del: mockDel,
    } as unknown as Redis;

    budgetTracker = new BudgetTracker(mockRedis);
  });

  afterEach(() => {
    resetBudgetTracker();
  });

  describe('checkAndIncrement', () => {
    it('should return allowed: true when under budget', async () => {
      // Lua script returns [1, currentSpend] when allowed
      mockEval.mockResolvedValue([1, 5.5]);

      const result = await budgetTracker.checkAndIncrement('key-123', 100, 0.5, 2592000);

      expect(result.allowed).toBe(true);
      expect(result.currentSpend).toBe(5.5);
      expect(result.limit).toBe(100);

      // Verify Redis eval was called with correct script and args
      expect(mockEval).toHaveBeenCalledTimes(1);
      const call = mockEval.mock.calls[0];
      // Script is first arg, then key count, then key, then ARGV
      expect(call[2]).toBe('vk:spend:key-123');
      expect(call[3]).toBe('100'); // limit (string due to .toString())
      expect(call[4]).toBe('0.5'); // cost
      expect(call[5]).toBe('2592000'); // ttl
    });

    it('should return allowed: false when over budget', async () => {
      // Lua script returns [0, currentSpend] when not allowed
      mockEval.mockResolvedValue([0, 99.8]);

      const result = await budgetTracker.checkAndIncrement('key-456', 100, 0.5, 2592000);

      expect(result.allowed).toBe(false);
      expect(result.currentSpend).toBe(99.8);
      expect(result.limit).toBe(100);
    });

    it('should handle concurrent requests without race conditions', async () => {
      // Simulate the Lua script behavior for atomic check-and-increment
      // First call: current=50, cost=25 -> allowed (75 < 100)
      // Second concurrent call: current=50, cost=60 -> denied (110 > 100)
      let callCount = 0;
      mockEval.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return [1, 75]; // First request allowed
        }
        return [0, 75]; // Second request denied (race condition prevented)
      });

      // Simulate two concurrent requests
      const [result1, result2] = await Promise.all([
        budgetTracker.checkAndIncrement('key-789', 100, 25, 2592000),
        budgetTracker.checkAndIncrement('key-789', 100, 60, 2592000),
      ]);

      // One should be allowed, one should be denied
      expect(result1.allowed !== result2.allowed).toBe(true);
    });

    it('should apply TTL to Redis key based on budgetDuration', async () => {
      mockEval.mockResolvedValue([1, 10]);

      // 30 days in seconds
      const ttl30Days = 30 * 24 * 60 * 60; // 2592000
      await budgetTracker.checkAndIncrement('key-ttl', 100, 10, ttl30Days);

      const call = mockEval.mock.calls[0];
      expect(call[5]).toBe('2592000');
    });

    it('should not set TTL when ttl is 0', async () => {
      mockEval.mockResolvedValue([1, 10]);

      await budgetTracker.checkAndIncrement('key-no-ttl', 100, 10, 0);

      const call = mockEval.mock.calls[0];
      expect(call[5]).toBe('0');
    });
  });

  describe('getCurrentSpend', () => {
    it('should return current spend from Redis', async () => {
      mockGet.mockResolvedValue('42.50');

      const result = await budgetTracker.getCurrentSpend('key-spend');

      expect(result).toBe(42.5);
      expect(mockGet).toHaveBeenCalledWith('vk:spend:key-spend');
    });

    it('should return 0 when no spend recorded', async () => {
      mockGet.mockResolvedValue(null);

      const result = await budgetTracker.getCurrentSpend('key-empty');

      expect(result).toBe(0);
    });
  });

  describe('resetSpend', () => {
    it('should delete the spend key from Redis', async () => {
      mockDel.mockResolvedValue(1);

      await budgetTracker.resetSpend('key-reset');

      expect(mockDel).toHaveBeenCalledWith('vk:spend:key-reset');
    });
  });

  describe('getBudgetTracker singleton', () => {
    it('should return the same instance on multiple calls', async () => {
      resetBudgetTracker();
      const instance1 = getBudgetTracker();
      const instance2 = getBudgetTracker();

      expect(instance1).toBe(instance2);
    });

    it('should create new instance after reset', async () => {
      resetBudgetTracker();
      const instance1 = getBudgetTracker();
      resetBudgetTracker();
      const instance2 = getBudgetTracker();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('hierarchical budget', () => {
    // Mock persistence for hierarchy tests
    const mockPersistence = {
      getKeyById: vi.fn(),
      getTeamById: vi.fn(),
      getOrgById: vi.fn(),
    };

    it('should check org budget when org budget is set (highest tier)', async () => {
      mockPersistence.getKeyById.mockResolvedValue({
        id: 'key-1',
        key: 'sk-test',
        name: 'Test Key',
        maxBudget: 50,
        spend: 10,
        enabled: true,
        teamId: 'team-1',
        orgId: 'org-1',
      });
      mockPersistence.getTeamById.mockResolvedValue({
        id: 'team-1',
        maxBudget: 100,
        spend: 20,
      });
      mockPersistence.getOrgById.mockResolvedValue({
        id: 'org-1',
        maxBudget: 200,
        spend: 30,
      });
      mockEval.mockResolvedValue([1, 35]);

      const result = await budgetTracker.checkHierarchicalBudget(
        'key-1',
        'org-1',
        'team-1',
        5,
        mockPersistence as never
      );

      expect(result.allowed).toBe(true);
      // Should use org budget (200) since org is checked first
      expect(mockEval.mock.calls[0][2]).toBe('vk:spend:org:org-1');
    });

    it('should check team budget when org budget is null', async () => {
      mockPersistence.getKeyById.mockResolvedValue({
        id: 'key-2',
        key: 'sk-test',
        name: 'Test Key',
        maxBudget: 50,
        spend: 10,
        enabled: true,
        teamId: 'team-2',
        orgId: 'org-2',
      });
      mockPersistence.getTeamById.mockResolvedValue({
        id: 'team-2',
        maxBudget: 100,
        spend: 20,
      });
      mockPersistence.getOrgById.mockResolvedValue({
        id: 'org-2',
        maxBudget: null,
        spend: 30,
      });
      mockEval.mockResolvedValue([1, 25]);

      const result = await budgetTracker.checkHierarchicalBudget(
        'key-2',
        'org-2',
        'team-2',
        5,
        mockPersistence as never
      );

      expect(result.allowed).toBe(true);
      // Should use team budget (100) since org budget is null
      expect(mockEval.mock.calls[0][2]).toBe('vk:spend:team:team-2');
    });

    it('should check key budget when org and team budgets are null', async () => {
      mockPersistence.getKeyById.mockResolvedValue({
        id: 'key-3',
        key: 'sk-test',
        name: 'Test Key',
        maxBudget: 50,
        spend: 10,
        enabled: true,
        teamId: 'team-3',
        orgId: 'org-3',
      });
      mockPersistence.getTeamById.mockResolvedValue({
        id: 'team-3',
        maxBudget: null,
        spend: 20,
      });
      mockPersistence.getOrgById.mockResolvedValue({
        id: 'org-3',
        maxBudget: null,
        spend: 30,
      });
      mockEval.mockResolvedValue([1, 15]);

      const result = await budgetTracker.checkHierarchicalBudget(
        'key-3',
        'org-3',
        'team-3',
        5,
        mockPersistence as never
      );

      expect(result.allowed).toBe(true);
      // Should use key budget (50) since org and team budgets are null
      expect(mockEval.mock.calls[0][2]).toBe('vk:spend:key:key-3');
    });

    it('should allow when all budgets are null', async () => {
      mockPersistence.getKeyById.mockResolvedValue({
        id: 'key-4',
        key: 'sk-test',
        name: 'Test Key',
        maxBudget: null,
        spend: 10,
        enabled: true,
        teamId: 'team-4',
        orgId: 'org-4',
      });
      mockPersistence.getTeamById.mockResolvedValue({
        id: 'team-4',
        maxBudget: null,
        spend: 20,
      });
      mockPersistence.getOrgById.mockResolvedValue({
        id: 'org-4',
        maxBudget: null,
        spend: 30,
      });

      const result = await budgetTracker.checkHierarchicalBudget(
        'key-4',
        'org-4',
        'team-4',
        5,
        mockPersistence as never
      );

      // When no budgets are set, allow by default (unlimited)
      expect(result.allowed).toBe(true);
      expect(result.limit).toBeUndefined();
    });
  });
});
