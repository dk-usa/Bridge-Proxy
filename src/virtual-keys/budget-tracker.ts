import type Redis from 'ioredis';
import { getRedis } from '../services/redis.js';
import type { BudgetCheckResult } from './service.js';

/**
 * Interface for persistence layer to fetch hierarchy data
 */
export interface HierarchyPersistence {
  getKeyById(id: string): Promise<{ id: string; maxBudget: number | null; spend: number } | null>;
  getTeamById(id: string): Promise<{ id: string; maxBudget: number | null; spend: number } | null>;
  getOrgById(id: string): Promise<{ id: string; maxBudget: number | null; spend: number } | null>;
}

/**
 * Redis Lua script for atomic budget check-and-increment
 *
 * Per D-08: Atomic budget enforcement prevents race conditions.
 *
 * Returns:
 * - [1, newSpend] if allowed (incremented)
 * - [0, currentSpend] if over budget (not incremented)
 *
 * KEYS[1]: The spend key (vk:spend:{keyId})
 * ARGV[1]: Budget limit (0 = unlimited)
 * ARGV[2]: Cost to add
 * ARGV[3]: TTL in seconds (0 = no expiry)
 */
const BUDGET_CHECK_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local cost = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
local current = tonumber(redis.call('GET', key) or '0')
if limit > 0 and current + cost > limit then
  return {0, current}
end
redis.call('INCRBYFLOAT', key, cost)
if ttl > 0 then redis.call('EXPIRE', key, ttl) end
return {1, current + cost}
`;

/**
 * BudgetTracker provides atomic budget enforcement using Redis Lua scripts.
 *
 * Per D-08: Atomic check-and-increment prevents budget race conditions.
 * Per D-06: Supports 4-tier budget hierarchy (org → team → key → provider).
 */
export class BudgetTracker {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  /**
   * Atomically check budget and increment spend if allowed.
   *
   * @param keyId - The virtual key ID
   * @param budget - The budget limit (0 = unlimited)
   * @param cost - The estimated cost for this request
   * @param ttlSeconds - TTL for the spend key (based on budgetDuration)
   * @returns BudgetCheckResult indicating if allowed and current spend
   */
  async checkAndIncrement(
    keyId: string,
    budget: number,
    cost: number,
    ttlSeconds: number
  ): Promise<BudgetCheckResult> {
    const redisKey = `vk:spend:${keyId}`;

    // Use EVAL for simplicity (EVALSHA would require script load first)
    const result = (await this.redis.eval(
      BUDGET_CHECK_SCRIPT,
      1,
      redisKey,
      budget.toString(),
      cost.toString(),
      ttlSeconds.toString()
    )) as [number, number];

    return {
      allowed: result[0] === 1,
      currentSpend: result[1],
      limit: budget,
    };
  }

  /**
   * Get the current spend for a key from Redis.
   *
   * @param keyId - The virtual key ID
   * @returns Current spend (0 if not set)
   */
  async getCurrentSpend(keyId: string): Promise<number> {
    const redisKey = `vk:spend:${keyId}`;
    const value = await this.redis.get(redisKey);
    return value ? parseFloat(value) : 0;
  }

  /**
   * Reset the spend counter for a key.
   *
   * @param keyId - The virtual key ID
   */
  async resetSpend(keyId: string): Promise<void> {
    const redisKey = `vk:spend:${keyId}`;
    await this.redis.del(redisKey);
  }

  /**
   * Convert budget duration string to seconds.
   *
   * @param duration - Duration string ('30d', '1m', etc.)
   * @returns Duration in seconds
   */
  static durationToSeconds(duration: string): number {
    if (duration.endsWith('d')) {
      const days = parseInt(duration.slice(0, -1), 10);
      return days * 24 * 60 * 60;
    }
    if (duration.endsWith('m')) {
      // '1m' = 30 days (monthly)
      const months = parseInt(duration.slice(0, -1), 10);
      return months * 30 * 24 * 60 * 60;
    }
    // Default to 30 days if unrecognized
    return 30 * 24 * 60 * 60;
  }

  /**
   * Check hierarchical budget across 4 tiers (org → team → key → provider).
   *
   * Per D-06: 4-tier budget hierarchy enforced in order:
   * 1. Org budget (if set)
   * 2. Team budget (if set)
   * 3. Key budget (if set)
   * 4. Provider budget (deferred - not in this phase)
   *
   * @param keyId - The virtual key ID
   * @param orgId - The organization ID (optional)
   * @param teamId - The team ID (optional)
   * @param cost - The estimated cost for this request
   * @param persistence - Persistence layer to fetch hierarchy data
   * @param ttlSeconds - TTL for the spend key (default: 30 days)
   * @returns BudgetCheckResult indicating if allowed and current spend
   */
  async checkHierarchicalBudget(
    keyId: string,
    orgId: string | undefined,
    teamId: string | undefined,
    cost: number,
    persistence: HierarchyPersistence,
    ttlSeconds: number = 30 * 24 * 60 * 60
  ): Promise<BudgetCheckResult> {
    // Fetch hierarchy data
    const key = await persistence.getKeyById(keyId);
    const team = teamId ? await persistence.getTeamById(teamId) : null;
    const org = orgId ? await persistence.getOrgById(orgId) : null;

    // Determine which tier has a budget set (in order: org → team → key)
    // Use the first tier with a budget set
    if (org?.maxBudget !== null && org?.maxBudget !== undefined) {
      // Check org budget
      return this.checkAndIncrement(`org:${org.id}`, org.maxBudget, cost, ttlSeconds);
    }

    if (team?.maxBudget !== null && team?.maxBudget !== undefined) {
      // Check team budget
      return this.checkAndIncrement(`team:${team.id}`, team.maxBudget, cost, ttlSeconds);
    }

    if (key?.maxBudget !== null && key?.maxBudget !== undefined) {
      // Check key budget
      return this.checkAndIncrement(`key:${key.id}`, key.maxBudget, cost, ttlSeconds);
    }

    // No budgets set - allow unlimited
    return {
      allowed: true,
      currentSpend: 0,
      limit: undefined,
    };
  }
}

// Singleton instance
let budgetTrackerInstance: BudgetTracker | null = null;

/**
 * Get or create the BudgetTracker singleton.
 *
 * Uses the default Redis connection from getRedis().
 */
export function getBudgetTracker(): BudgetTracker {
  if (!budgetTrackerInstance) {
    const redis = getRedis();
    if (!redis) {
      throw new Error('Redis not initialized. Call initRedis() first.');
    }
    budgetTrackerInstance = new BudgetTracker(redis);
  }
  return budgetTrackerInstance;
}

/**
 * Reset the singleton (for testing).
 */
export function resetBudgetTracker(): void {
  budgetTrackerInstance = null;
}
