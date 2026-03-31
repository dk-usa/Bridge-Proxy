import type { VirtualKeyPersistence, CreateKeyOptions } from './persistence.js';
import type { VirtualKey } from '../db/schema-virtual-keys.js';

/**
 * Result of a budget check operation
 */
export interface BudgetCheckResult {
  allowed: boolean;
  currentSpend: number;
  limit?: number;
}

/**
 * Service layer for virtual key management and validation
 *
 * Per D-05, D-06: Key validation and budget tracking.
 * Hierarchical budget support will be added in plan 05.
 */
export class VirtualKeyService {
  public persistence: VirtualKeyPersistence;

  constructor(persistence: VirtualKeyPersistence) {
    this.persistence = persistence;
  }

  /**
   * Validate a key for use in API requests
   *
   * Checks:
   * - Key format (must start with 'sk-')
   * - Key exists in database
   * - Key is enabled
   * - Key has not expired
   * - Budget not exceeded
   */
  async validateKey(key: string): Promise<VirtualKey | null> {
    // Check key format
    if (!key.startsWith('sk-')) {
      return null;
    }

    // Look up key by value
    const virtualKey = await this.persistence.getKeyByValue(key);
    if (!virtualKey) {
      return null;
    }

    // Check if enabled
    if (!virtualKey.enabled) {
      return null;
    }

    // Check expiration
    if (virtualKey.expiresAt) {
      const expiresAt = new Date(virtualKey.expiresAt);
      if (expiresAt < new Date()) {
        return null;
      }
    }

    // Check budget (spend < maxBudget)
    if (virtualKey.maxBudget !== undefined && virtualKey.spend >= virtualKey.maxBudget) {
      return null;
    }

    return virtualKey;
  }

  /**
   * Check if a key has budget remaining for a given cost
   *
   * Per D-06: This is a synchronous check. Atomic enforcement happens in plan 05.
   */
  async checkBudget(id: string, estimatedCost: number): Promise<BudgetCheckResult> {
    const key = await this.persistence.getKeyById(id);

    if (!key) {
      return { allowed: false, currentSpend: 0 };
    }

    const currentSpend = key.spend;

    // No budget limit = unlimited
    if (key.maxBudget === undefined) {
      return { allowed: true, currentSpend, limit: undefined };
    }

    const limit = key.maxBudget;
    const allowed = currentSpend + estimatedCost <= limit;

    return { allowed, currentSpend, limit };
  }

  /**
   * Record usage cost against a key
   */
  async recordUsage(id: string, cost: number): Promise<void> {
    await this.persistence.recordUsage(id, cost);
  }

  /**
   * Create a new virtual key
   */
  async createKey(options: CreateKeyOptions): Promise<VirtualKey> {
    return this.persistence.createKey(options);
  }

  /**
   * Update a virtual key
   */
  async updateKey(
    id: string,
    updates: Partial<Omit<VirtualKey, 'id' | 'key' | 'createdAt'>>
  ): Promise<VirtualKey | null> {
    return this.persistence.updateKey(id, updates);
  }

  /**
   * Delete a virtual key
   */
  async deleteKey(id: string): Promise<boolean> {
    return this.persistence.deleteKey(id);
  }

  /**
   * List virtual keys, optionally filtered by team
   */
  async listKeys(teamId?: string): Promise<VirtualKey[]> {
    return this.persistence.listKeys(teamId);
  }

  /**
   * Reset spend to zero (for budget period reset)
   */
  async resetSpend(id: string): Promise<void> {
    await this.persistence.resetSpend(id);
  }
}

// Singleton instance (initialized when db is ready)
let virtualKeyServiceInstance: VirtualKeyService | null = null;

/**
 * Get or create the virtual key service singleton
 */
export function getVirtualKeyService(persistence?: VirtualKeyPersistence): VirtualKeyService {
  if (!virtualKeyServiceInstance && persistence) {
    virtualKeyServiceInstance = new VirtualKeyService(persistence);
  }
  if (!virtualKeyServiceInstance) {
    throw new Error(
      'VirtualKeyService not initialized. Call getVirtualKeyService with persistence first.'
    );
  }
  return virtualKeyServiceInstance;
}

/**
 * Reset the singleton (for testing)
 */
export function resetVirtualKeyService(): void {
  virtualKeyServiceInstance = null;
}
