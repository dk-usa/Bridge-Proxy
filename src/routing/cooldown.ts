import type Redis from 'ioredis';
import type { CooldownConfig } from './types.js';
import { DEFAULT_COOLDOWN_CONFIG } from './types.js';

/**
 * CooldownManager - Tracks deployment failures and manages cooldown periods.
 * Per D-11: Configurable allowed_fails (default 3) and cooldown_time (default 30s).
 * Per RESEARCH.md §Pattern 3: Uses Redis atomic operations (INCR, SETEX) for distributed tracking.
 */
export class CooldownManager {
  private readonly redis: Redis;
  private readonly config: CooldownConfig;

  constructor(redis: Redis, config: Partial<CooldownConfig> = {}) {
    this.redis = redis;
    this.config = { ...DEFAULT_COOLDOWN_CONFIG, ...config };
  }

  /**
   * Record a failure for a deployment.
   * Increments failure count, triggers cooldown if threshold reached.
   */
  async recordFailure(deploymentId: string): Promise<void> {
    const failKey = `deploy:fails:${deploymentId}`;
    const cooldownKey = `deploy:cooldown:${deploymentId}`;

    // Increment failure count atomically
    const failCount = await this.redis.incr(failKey);

    // Check if cooldown should be triggered
    if (failCount >= this.config.allowedFails) {
      // Set cooldown with TTL
      await this.redis.setex(
        cooldownKey,
        this.config.cooldownTimeSeconds,
        new Date().toISOString()
      );

      // Clear failure count (fresh start after cooldown)
      await this.redis.del(failKey);
    }
  }

  /**
   * Check if a deployment is in cooldown.
   */
  async isInCooldown(deploymentId: string): Promise<boolean> {
    const cooldownKey = `deploy:cooldown:${deploymentId}`;
    const cooldown = await this.redis.get(cooldownKey);
    return cooldown !== null;
  }

  /**
   * Clear cooldown for a deployment (manual override).
   */
  async clearCooldown(deploymentId: string): Promise<void> {
    const failKey = `deploy:fails:${deploymentId}`;
    const cooldownKey = `deploy:cooldown:${deploymentId}`;

    await this.redis.del(cooldownKey);
    await this.redis.del(failKey);
  }

  /**
   * Record success for a deployment - clears failure count and cooldown.
   */
  async recordSuccess(deploymentId: string): Promise<void> {
    const failKey = `deploy:fails:${deploymentId}`;
    const cooldownKey = `deploy:cooldown:${deploymentId}`;

    // Clear both keys on success
    await this.redis.del(failKey);
    await this.redis.del(cooldownKey);
  }

  /**
   * Get current failure count for a deployment.
   */
  async getFailureCount(deploymentId: string): Promise<number> {
    const failKey = `deploy:fails:${deploymentId}`;
    const count = await this.redis.get(failKey);
    return count ? parseInt(count, 10) : 0;
  }

  /**
   * Get the configured cooldown time in seconds.
   */
  getCooldownTimeSeconds(): number {
    return this.config.cooldownTimeSeconds;
  }

  /**
   * Get the configured allowed failures threshold.
   */
  getAllowedFails(): number {
    return this.config.allowedFails;
  }
}
