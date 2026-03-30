import type { VirtualKey } from '../db/schema-virtual-keys.js';
import { getVirtualKeyService, type VirtualKeyService } from './service.js';
import type { VirtualKeyPersistence } from './persistence.js';

/**
 * Default grace period for key rotation (24 hours)
 * Per D-07: Grace period rotation — new key generated, old key works for configurable grace period
 */
export const DEFAULT_GRACE_PERIOD_HOURS = 24;

/**
 * Interface for rotation result
 */
export interface RotationResult {
  newKey: VirtualKey;
  oldKey: VirtualKey;
}

/**
 * KeyRotationService handles key rotation with grace periods.
 *
 * Per D-07: Grace period rotation — new key generated, old key works
 * for configurable grace period, then disabled.
 */
export class KeyRotationService {
  private virtualKeyService: VirtualKeyService;
  private persistence: VirtualKeyPersistence;
  private gracePeriodHours: number;

  constructor(
    virtualKeyService: VirtualKeyService,
    persistence: VirtualKeyPersistence,
    gracePeriodHours: number = DEFAULT_GRACE_PERIOD_HOURS
  ) {
    this.virtualKeyService = virtualKeyService;
    this.persistence = persistence;
    this.gracePeriodHours = gracePeriodHours;
  }

  /**
   * Rotate a key, creating a new key and marking the old for grace period.
   *
   * @param keyId - The ID of the key to rotate
   * @returns The new and old key
   */
  async rotateKey(keyId: string): Promise<RotationResult> {
    // Get the existing key
    const oldKey = await this.persistence.getKeyById(keyId);
    if (!oldKey) {
      throw new Error('Key not found');
    }

    // Create new key with same settings
    const newKey = await this.virtualKeyService.createKey({
      name: oldKey.name,
      description: oldKey.description,
      teamId: oldKey.teamId,
      orgId: oldKey.orgId,
      models: oldKey.models,
      maxBudget: oldKey.maxBudget,
      budgetDuration: oldKey.budgetDuration,
      rpmLimit: oldKey.rpmLimit,
      tpmLimit: oldKey.tpmLimit,
      rotationEnabled: oldKey.rotationEnabled,
      rotationIntervalDays: oldKey.rotationIntervalDays,
      metadata: oldKey.metadata,
    });

    // Calculate grace period expiration
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.gracePeriodHours);

    // Update old key with rotation metadata
    const updatedOldKey = await this.persistence.updateKey(keyId, {
      rotatedTo: newKey.id,
      expiresAt: expiresAt.toISOString(),
    });

    // Update new key with rotation source
    await this.persistence.updateKey(newKey.id, {
      rotatedFrom: keyId,
    });

    return {
      newKey: { ...newKey, rotatedFrom: keyId },
      oldKey: updatedOldKey!,
    };
  }

  /**
   * Get all active keys for a given key (including rotated keys in grace period).
   *
   * @param keyId - The key ID to check
   * @returns Array of active keys (may include both old and new during grace period)
   */
  async getActiveKeys(keyId: string): Promise<VirtualKey[]> {
    const key = await this.persistence.getKeyById(keyId);
    if (!key) {
      return [];
    }

    const activeKeys: VirtualKey[] = [key];

    // If this key was rotated from another key, check if old key is still valid
    if (key.rotatedFrom) {
      const oldKey = await this.persistence.getKeyById(key.rotatedFrom);
      if (oldKey && oldKey.enabled && oldKey.expiresAt) {
        const expiresAt = new Date(oldKey.expiresAt);
        if (expiresAt > new Date()) {
          // Old key is still in grace period
          activeKeys.push(oldKey);
        }
      }
    }

    // If this key has been rotated to a new key, check if new key exists
    if (key.rotatedTo) {
      const newKey = await this.persistence.getKeyById(key.rotatedTo);
      if (newKey && newKey.enabled) {
        activeKeys.push(newKey);
      }
    }

    return activeKeys;
  }

  /**
   * Disable all keys that have expired after grace period.
   * Should be called periodically (e.g., via scheduled job).
   */
  async disableExpiredKeys(): Promise<void> {
    const allKeys = await this.persistence.listKeys();

    for (const key of allKeys) {
      // Check if key is in grace period and expired
      if (key.rotatedTo && key.expiresAt) {
        const expiresAt = new Date(key.expiresAt);
        if (expiresAt < new Date() && key.enabled) {
          // Grace period expired, disable the key
          await this.persistence.updateKey(key.id, { enabled: false });
        }
      }
    }
  }
}

// Singleton instance
let rotationServiceInstance: KeyRotationService | null = null;

/**
 * Get or create the KeyRotationService singleton.
 */
export function getKeyRotationService(): KeyRotationService {
  if (!rotationServiceInstance) {
    const virtualKeyService = getVirtualKeyService();
    // We need to get persistence from the service
    // For now, create a simple persistence wrapper
    const persistence = {
      getKeyById: async (id: string) =>
        virtualKeyService.listKeys().then((keys) => keys.find((k) => k.id === id) ?? null),
      updateKey: async (id: string, updates: Partial<VirtualKey>) =>
        virtualKeyService.updateKey(id, updates),
      listKeys: async () => virtualKeyService.listKeys(),
    } as VirtualKeyPersistence;

    rotationServiceInstance = new KeyRotationService(virtualKeyService, persistence);
  }
  return rotationServiceInstance;
}

/**
 * Reset the singleton (for testing).
 */
export function resetKeyRotationService(): void {
  rotationServiceInstance = null;
}
