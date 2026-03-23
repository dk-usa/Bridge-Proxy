import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const organizations = sqliteTable('organizations', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  budget: real('budget'),
  budgetResetAt: text('budget_reset_at'),
  spend: real('spend').default(0),
  requestCount: integer('request_count').default(0),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  metadata: text('metadata', { mode: 'json' }),
});

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').references(() => organizations.id),
  name: text('name').notNull(),
  description: text('description'),
  budget: real('budget'),
  budgetResetAt: text('budget_reset_at'),
  spend: real('spend').default(0),
  requestCount: integer('request_count').default(0),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  metadata: text('metadata', { mode: 'json' }),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').references(() => organizations.id),
  teamId: text('team_id').references(() => teams.id),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  budget: real('budget'),
  budgetResetAt: text('budget_reset_at'),
  spend: real('spend').default(0),
  requestCount: integer('request_count').default(0),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  metadata: text('metadata', { mode: 'json' }),
});

export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey(),
  keyHash: text('key_hash').notNull().unique(),
  keyValueEncrypted: text('key_value_encrypted').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  userId: text('user_id').references(() => users.id),
  teamId: text('team_id').references(() => teams.id),
  organizationId: text('organization_id').references(() => organizations.id),
  modelRestrictions: text('model_restrictions', { mode: 'json' }).$type<string[]>(),
  budget: real('budget'),
  budgetResetAt: text('budget_reset_at'),
  spend: real('spend').default(0),
  requestCount: integer('request_count').default(0),
  rateLimit: integer('rate_limit'),
  enabled: integer('enabled', { mode: 'boolean' }).default(true),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
  expiresAt: text('expires_at'),
  lastUsedAt: text('last_used_at'),
  metadata: text('metadata', { mode: 'json' }),
});

export const usageLogs = sqliteTable('usage_logs', {
  id: text('id').primaryKey(),
  apiKeyId: text('api_key_id').references(() => apiKeys.id),
  model: text('model').notNull(),
  provider: text('provider'),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  totalTokens: integer('total_tokens'),
  cost: real('cost'),
  latencyMs: integer('latency_ms'),
  status: text('status'),
  error: text('error'),
  createdAt: text('created_at').default(sql`(datetime('now'))`),
});

export const modelPricing = sqliteTable('model_pricing', {
  id: text('id').primaryKey(),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  inputCostPer1k: real('input_cost_per_1k'),
  outputCostPer1k: real('output_cost_per_1k'),
  updatedAt: text('updated_at').default(sql`(datetime('now'))`),
});

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;
export type UsageLog = typeof usageLogs.$inferSelect;
export type NewUsageLog = typeof usageLogs.$inferInsert;
export type ModelPricing = typeof modelPricing.$inferSelect;
export type NewModelPricing = typeof modelPricing.$inferInsert;
