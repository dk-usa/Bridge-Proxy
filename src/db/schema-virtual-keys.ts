import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Virtual Keys Schema
 *
 * Per D-05: Configurable storage via DATABASE_TYPE env var.
 * This schema defines the virtual keys table for SQLite (single-instance).
 *
 * Virtual keys provide:
 * - Per-key budgets with spend tracking
 * - Model restrictions
 * - Rate limits (RPM/TPM)
 * - Key rotation with grace period
 * - Team/Org association for hierarchical budgets
 */
export const virtualKeys = sqliteTable(
  'virtual_keys',
  {
    // Primary key - UUID
    id: text('id').primaryKey(),

    // The sk-{random} key string - must be unique
    key: text('key').notNull().unique(),

    // Human-readable name
    name: text('name').notNull(),

    // Optional description
    description: text('description'),

    // Team association (optional)
    teamId: text('team_id'),

    // Organization association (optional)
    orgId: text('org_id'),

    // JSON array of allowed model names (e.g., ["gpt-4", "claude-3-opus"])
    models: text('models', { mode: 'json' }).$type<string[]>(),

    // Budget in USD (nullable = unlimited)
    maxBudget: real('max_budget'),

    // Budget reset period: '30d', '1m', etc.
    budgetDuration: text('budget_duration'),

    // Current spend in USD
    spend: real('spend').default(0),

    // Rate limit: requests per minute
    rpmLimit: integer('rpm_limit'),

    // Rate limit: tokens per minute
    tpmLimit: integer('tpm_limit'),

    // Key enabled status (SQLite uses 0/1 for boolean)
    enabled: integer('enabled', { mode: 'boolean' }).default(true),

    // Creation timestamp
    createdAt: text('created_at').default(sql`(datetime('now'))`),

    // Expiration timestamp (nullable = no expiry)
    expiresAt: text('expires_at'),

    // Key rotation settings
    rotationEnabled: integer('rotation_enabled', { mode: 'boolean' }).default(false),
    rotationIntervalDays: integer('rotation_interval_days'),
    lastRotatedAt: text('last_rotated_at'),
    rotatedFrom: text('rotated_from'), // Previous key ID after rotation
    rotatedTo: text('rotated_to'), // New key ID after rotation

    // Arbitrary JSON metadata
    metadata: text('metadata', { mode: 'json' }),
  },
  (table) => ({
    // Index on key for fast lookup by key value
    virtualKeysIdx: index('idx_virtual_keys_key').on(table.key),
    // Index on teamId for listing keys by team
    virtualKeysTeamIdx: index('idx_virtual_keys_team').on(table.teamId),
    // Index on orgId for listing keys by org
    virtualKeysOrgIdx: index('idx_virtual_keys_org').on(table.orgId),
  })
);

// Type exports for type-safe database operations
export type VirtualKeyRow = typeof virtualKeys.$inferSelect;
export type NewVirtualKeyRow = typeof virtualKeys.$inferInsert;

// Application-level type with undefined for optional fields (easier to work with)
export interface VirtualKey {
  id: string;
  key: string;
  name: string;
  description?: string;
  teamId?: string;
  orgId?: string;
  models?: string[];
  maxBudget?: number;
  budgetDuration?: string;
  spend: number;
  rpmLimit?: number;
  tpmLimit?: number;
  enabled: boolean;
  createdAt: string;
  expiresAt?: string;
  rotationEnabled: boolean;
  rotationIntervalDays?: number;
  lastRotatedAt?: string;
  rotatedFrom?: string; // Previous key ID after rotation
  rotatedTo?: string; // New key ID after rotation
  metadata?: Record<string, unknown>;
}

// Insert type with null for database operations
export type NewVirtualKey = NewVirtualKeyRow;
