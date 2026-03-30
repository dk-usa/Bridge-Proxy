import { describe, it, expect, beforeEach } from 'vitest';
import { RetryBudget } from '../../../src/routing/retry-budget.js';

describe('RetryBudget', () => {
  describe('constructor', () => {
    it('should initialize with default maxRetries', () => {
      const budget = new RetryBudget();
      expect(budget.maxRetries).toBe(2);
      expect(budget.retryDepth).toBe(0);
    });

    it('should initialize with custom maxRetries', () => {
      const budget = new RetryBudget(5);
      expect(budget.maxRetries).toBe(5);
    });
  });

  describe('canRetry', () => {
    it('should return true when retryDepth < maxRetries', () => {
      const budget = new RetryBudget(2);
      expect(budget.canRetry()).toBe(true);

      budget.increment();
      expect(budget.canRetry()).toBe(true);
    });

    it('should return false when retryDepth >= maxRetries', () => {
      const budget = new RetryBudget(2);
      budget.increment(); // depth = 1
      budget.increment(); // depth = 2
      expect(budget.canRetry()).toBe(false);
    });

    it('should work with zero maxRetries', () => {
      const budget = new RetryBudget(0);
      expect(budget.canRetry()).toBe(false);
    });
  });

  describe('increment', () => {
    it('should increase retryDepth by 1', () => {
      const budget = new RetryBudget(5);
      expect(budget.retryDepth).toBe(0);

      budget.increment();
      expect(budget.retryDepth).toBe(1);

      budget.increment();
      expect(budget.retryDepth).toBe(2);
    });
  });

  describe('reset', () => {
    it('should set retryDepth to 0', () => {
      const budget = new RetryBudget(5);
      budget.increment();
      budget.increment();
      expect(budget.retryDepth).toBe(2);

      budget.reset();
      expect(budget.retryDepth).toBe(0);
    });
  });

  describe('remaining', () => {
    it('should return remaining retries', () => {
      const budget = new RetryBudget(3);
      expect(budget.remaining()).toBe(3);

      budget.increment();
      expect(budget.remaining()).toBe(2);

      budget.increment();
      expect(budget.remaining()).toBe(1);

      budget.increment();
      expect(budget.remaining()).toBe(0);
    });
  });

  describe('exhausted', () => {
    it('should return true when no retries remaining', () => {
      const budget = new RetryBudget(2);
      expect(budget.exhausted()).toBe(false);

      budget.increment();
      expect(budget.exhausted()).toBe(false);

      budget.increment();
      expect(budget.exhausted()).toBe(true);
    });

    it('should return true immediately with zero maxRetries', () => {
      const budget = new RetryBudget(0);
      expect(budget.exhausted()).toBe(true);
    });
  });
});
