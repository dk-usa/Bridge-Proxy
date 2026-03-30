import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import {
  virtualKeys,
  type VirtualKey,
  type VirtualKeyRow,
  type NewVirtualKey,
} from '../db/schema-virtual-keys.js';

/**
 * Options for creating a new virtual key
 */
export interface CreateKeyOptions {
  name: string;
  description?: string;
  teamId?: string;
  orgId?: string;
  models?: string[];
  maxBudget?: number;
  budgetDuration?: string;
  rpmLimit?: number;
  tpmLimit?: number;
  expiresInDays?: number;
  rotationEnabled?: boolean;
  rotationIntervalDays?: number;
  metadata?: Record<string, unknown>;
  key?: string; // Custom key value (for testing or import)
}

/**
 * Persistence layer for virtual keys using Drizzle ORM
 *
 * Per D-05: SQLite storage for single-instance deployments.
 */
export class VirtualKeyPersistence {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(db: any) {
    this.db = db;
  }

  /**
   * Generate a unique key with sk- prefix
   */
  private generateKey(): string {
    return `sk-${crypto.randomBytes(32).toString('hex')}`;
  }

  /**
   * Generate a UUID for record IDs
   */
  private generateId(): string {
    return crypto.randomUUID();
  }

  /**
   * Create a new virtual key
   */
  async createKey(options: CreateKeyOptions): Promise<VirtualKey> {
    const id = this.generateId();
    const key = options.key && options.key.startsWith('sk-') ? options.key : this.generateKey();
    const now = new Date().toISOString();

    let expiresAt: string | null = null;
    if (options.expiresInDays && options.expiresInDays > 0) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + options.expiresInDays);
      expiresAt = expiryDate.toISOString();
    }

    const newKey = {
      id,
      key,
      name: options.name,
      description: options.description ?? null,
      teamId: options.teamId ?? null,
      orgId: options.orgId ?? null,
      models: options.models ?? null,
      maxBudget: options.maxBudget ?? null,
      budgetDuration: options.budgetDuration ?? null,
      spend: 0 as number,
      rpmLimit: options.rpmLimit ?? null,
      tpmLimit: options.tpmLimit ?? null,
      enabled: true as boolean,
      createdAt: now,
      expiresAt,
      rotationEnabled: options.rotationEnabled ?? false,
      rotationIntervalDays: options.rotationIntervalDays ?? null,
      lastRotatedAt: null as string | null,
      rotatedFrom: null as string | null,
      rotatedTo: null as string | null,
      metadata: options.metadata ?? null,
    } satisfies NewVirtualKey;

    await this.db.insert(virtualKeys).values(newKey);

    // Return the created key - map null to undefined for optional fields
    return this.rowToVirtualKey(newKey);
  }

  /**
   * Get a virtual key by ID
   */
  async getKeyById(id: string): Promise<VirtualKey | null> {
    const results = await this.db.select().from(virtualKeys).where(eq(virtualKeys.id, id));
    return results.length > 0 ? this.rowToVirtualKey(results[0]) : null;
  }

  /**
   * Get a virtual key by its key value
   */
  async getKeyByValue(key: string): Promise<VirtualKey | null> {
    const results = await this.db.select().from(virtualKeys).where(eq(virtualKeys.key, key));
    return results.length > 0 ? this.rowToVirtualKey(results[0]) : null;
  }

  /**
   * Update a virtual key
   */
  async updateKey(
    id: string,
    updates: Partial<Omit<VirtualKey, 'id' | 'key' | 'createdAt'>>
  ): Promise<VirtualKey | null> {
    const existing = await this.getKeyById(id);
    if (!existing) {
      return null;
    }

    // Convert undefined to null for database updates
    const dbUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(updates)) {
      dbUpdates[key] = value === undefined ? null : value;
    }

    await this.db.update(virtualKeys).set(dbUpdates).where(eq(virtualKeys.id, id));
    return this.getKeyById(id);
  }

  /**
   * Delete a virtual key
   */
  async deleteKey(id: string): Promise<boolean> {
    const existing = await this.getKeyById(id);
    if (!existing) {
      return false;
    }

    await this.db.delete(virtualKeys).where(eq(virtualKeys.id, id));
    return true;
  }

  /**
   * List virtual keys, optionally filtered by team
   */
  async listKeys(teamId?: string): Promise<VirtualKey[]> {
    const baseQuery = this.db.select().from(virtualKeys);

    const results = teamId
      ? await baseQuery.where(eq(virtualKeys.teamId, teamId))
      : await baseQuery;

    return results.map((row: VirtualKeyRow) => this.rowToVirtualKey(row));
  }

  /**
   * Record usage (increment spend)
   */
  async recordUsage(id: string, cost: number): Promise<void> {
    const existing = await this.getKeyById(id);
    if (!existing) {
      return;
    }

    const currentSpend = existing.spend ?? 0;
    const newSpend = currentSpend + cost;
    await this.db.update(virtualKeys).set({ spend: newSpend }).where(eq(virtualKeys.id, id));
  }

  /**
   * Reset spend to zero
   */
  async resetSpend(id: string): Promise<void> {
    await this.db.update(virtualKeys).set({ spend: 0 }).where(eq(virtualKeys.id, id));
  }

  /**
   * Map database row to VirtualKey type, converting null to undefined for optional fields
   */
  private rowToVirtualKey(row: VirtualKeyRow): VirtualKey {
    return {
      id: row.id,
      key: row.key,
      name: row.name,
      description: row.description ?? undefined,
      teamId: row.teamId ?? undefined,
      orgId: row.orgId ?? undefined,
      models: row.models ?? undefined,
      maxBudget: row.maxBudget ?? undefined,
      budgetDuration: row.budgetDuration ?? undefined,
      spend: row.spend ?? 0,
      rpmLimit: row.rpmLimit ?? undefined,
      tpmLimit: row.tpmLimit ?? undefined,
      enabled: row.enabled ?? true,
      createdAt: row.createdAt ?? new Date().toISOString(),
      expiresAt: row.expiresAt ?? undefined,
      rotationEnabled: row.rotationEnabled ?? false,
      rotationIntervalDays: row.rotationIntervalDays ?? undefined,
      lastRotatedAt: row.lastRotatedAt ?? undefined,
      rotatedFrom: row.rotatedFrom ?? undefined,
      rotatedTo: row.rotatedTo ?? undefined,
      metadata: row.metadata ? (row.metadata as Record<string, unknown>) : undefined,
    };
  }
}
