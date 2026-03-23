import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';
import { join } from 'path';
import { mkdirSync } from 'fs';

mkdirSync(join(process.cwd(), 'data'), { recursive: true });
const sqlite: BetterSqlite3.Database = new BetterSqlite3(
  join(process.cwd(), 'data', 'llm-gateway.db')
);

sqlite.exec('PRAGMA journal_mode = WAL;');
sqlite.exec('PRAGMA foreign_keys = ON;');

export const db = drizzle(sqlite, { schema });

export async function initializeDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      budget REAL,
      budget_reset_at TEXT,
      spend REAL DEFAULT 0,
      request_count INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      organization_id TEXT REFERENCES organizations(id),
      name TEXT NOT NULL,
      description TEXT,
      budget REAL,
      budget_reset_at TEXT,
      spend REAL DEFAULT 0,
      request_count INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      organization_id TEXT REFERENCES organizations(id),
      team_id TEXT REFERENCES teams(id),
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      budget REAL,
      budget_reset_at TEXT,
      spend REAL DEFAULT 0,
      request_count INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      key_hash TEXT NOT NULL UNIQUE,
      key_value_encrypted TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      user_id TEXT REFERENCES users(id),
      team_id TEXT REFERENCES teams(id),
      organization_id TEXT REFERENCES organizations(id),
      model_restrictions TEXT,
      budget REAL,
      budget_reset_at TEXT,
      spend REAL DEFAULT 0,
      request_count INTEGER DEFAULT 0,
      rate_limit INTEGER,
      enabled INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT,
      last_used_at TEXT,
      metadata TEXT
    );

    CREATE TABLE IF NOT EXISTS usage_logs (
      id TEXT PRIMARY KEY,
      api_key_id TEXT REFERENCES api_keys(id),
      model TEXT NOT NULL,
      provider TEXT,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      cost REAL,
      latency_ms INTEGER,
      status TEXT,
      error TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS model_pricing (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      input_cost_per_1k REAL,
      output_cost_per_1k REAL,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(provider, model)
    );

    CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
    CREATE INDEX IF NOT EXISTS idx_api_keys_team ON api_keys(team_id);
    CREATE INDEX IF NOT EXISTS idx_api_keys_org ON api_keys(organization_id);
    CREATE INDEX IF NOT EXISTS idx_usage_logs_key ON usage_logs(api_key_id);
    CREATE INDEX IF NOT EXISTS idx_usage_logs_created ON usage_logs(created_at);
  `);
}

export { sqlite };
