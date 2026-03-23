import { getRedis, isRedisAvailable } from './redis.js';

export interface BudgetCheck {
  allowed: boolean;
  reason?: string;
  currentSpend: number;
  budget: number | null;
  remaining: number | null;
}

export class BudgetService {
  async checkBudget(apiKey: {
    budget?: number | null;
    spend?: number | null;
  }): Promise<BudgetCheck> {
    const budget = apiKey.budget;
    const spend = apiKey.spend ?? 0;

    if (budget === null || budget === undefined) {
      return { allowed: true, currentSpend: spend, budget: null, remaining: null };
    }

    if (spend >= budget) {
      return {
        allowed: false,
        reason: `Budget exceeded. Current spend: $${spend.toFixed(6)}, Budget: $${budget}`,
        currentSpend: spend,
        budget,
        remaining: 0,
      };
    }

    return {
      allowed: true,
      currentSpend: spend,
      budget,
      remaining: budget - spend,
    };
  }

  async enforceBudgetReset(
    resetSchedules: Array<{
      id: string;
      type: 'key' | 'team' | 'org';
      budgetResetAt?: string | null;
    }>
  ): Promise<void> {
    const redis = getRedis();

    if (!redis || !isRedisAvailable()) {
      return;
    }

    const now = new Date();

    for (const schedule of resetSchedules) {
      if (!schedule.budgetResetAt) continue;

      const resetDate = new Date(schedule.budgetResetAt);
      if (resetDate <= now) {
        const key = `budget:reset:${schedule.id}:${schedule.type}`;
        const nextResetDate = this.calculateNextReset(schedule.budgetResetAt);
        await redis.set(key, nextResetDate.toISOString());
      }
    }
  }

  private calculateNextReset(currentReset: string): Date {
    const date = new Date(currentReset);
    const now = new Date();

    while (date <= now) {
      date.setMonth(date.getMonth() + 1);
    }

    return date;
  }

  async recordSpend(apiKeyId: string, cost: number): Promise<void> {
    const redis = getRedis();
    if (redis && isRedisAvailable()) {
      const key = `spend:${apiKeyId}:${new Date().toISOString().slice(0, 7)}`;
      await redis.incrbyfloat(key, cost);
      await redis.expire(key, 86400 * 60);
    }
  }

  async getSpendHistory(
    apiKeyId: string,
    months: number = 6
  ): Promise<{ month: string; spend: number }[]> {
    const redis = getRedis();
    const history: { month: string; spend: number }[] = [];

    if (!redis || !isRedisAvailable()) {
      return history;
    }

    const now = new Date();
    for (let i = 0; i < months; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const key = `spend:${apiKeyId}:${month}`;
      const spend = await redis.get(key);
      history.push({ month, spend: spend ? parseFloat(spend) : 0 });
    }

    return history;
  }
}

export const budgetService = new BudgetService();
