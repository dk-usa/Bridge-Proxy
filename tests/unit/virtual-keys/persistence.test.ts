import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import BetterSqlite3 from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from '../../../src/db/schema.js';
import { virtualKeys } from '../../../src/db/schema-virtual-keys.js';
import { VirtualKeyPersistence } from '../../../src/virtual-keys/persistence.js';

describe('VirtualKeyPersistence', () => {
  let sqlite: BetterSqlite3.Database;
  let db: ReturnType<typeof drizzle>;
  let persistence: VirtualKeyPersistence;

  beforeEach(async () => {
    // Create in-memory SQLite database for testing
    sqlite = new BetterSqlite3(':memory:');
    sqlite.exec('PRAGMA foreign_keys = ON;');
    db = drizzle(sqlite, { schema });

    // Create the virtual_keys table
    sqlite.exec(`
      CREATE TABLE virtual_keys (
        id TEXT PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        description TEXT,
        team_id TEXT,
        org_id TEXT,
        models TEXT,
        max_budget REAL,
        budget_duration TEXT,
        spend REAL DEFAULT 0,
        rpm_limit INTEGER,
        tpm_limit INTEGER,
        enabled INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT,
        rotation_enabled INTEGER DEFAULT 0,
        rotation_interval_days INTEGER,
        last_rotated_at TEXT,
        rotated_from TEXT,
        rotated_to TEXT,
        metadata TEXT
      )
    `);

    persistence = new VirtualKeyPersistence(db);
  });

  afterEach(() => {
    sqlite.close();
  });

  describe('createKey', () => {
    it('should insert record and return VirtualKey', async () => {
      const key = await persistence.createKey({
        name: 'Test Key',
        description: 'A test key',
      });

      expect(key).toBeDefined();
      expect(key.id).toBeDefined();
      expect(key.key).toMatch(/^sk-[a-f0-9]{64}$/);
      expect(key.name).toBe('Test Key');
      expect(key.description).toBe('A test key');
      expect(key.enabled).toBe(true);
      expect(key.spend).toBe(0);
    });

    it('should accept custom key prefix', async () => {
      const key = await persistence.createKey({
        name: 'Custom Key',
        key: 'sk-custom123',
      });

      expect(key.key).toBe('sk-custom123');
    });

    it('should store models as JSON array', async () => {
      const key = await persistence.createKey({
        name: 'Restricted Key',
        models: ['gpt-4', 'claude-3-opus'],
      });

      expect(key.models).toEqual(['gpt-4', 'claude-3-opus']);
    });

    it('should store metadata as JSON object', async () => {
      const key = await persistence.createKey({
        name: 'Key with Metadata',
        metadata: { owner: 'team-alpha', project: 'analytics' },
      });

      expect(key.metadata).toEqual({ owner: 'team-alpha', project: 'analytics' });
    });
  });

  describe('getKeyById', () => {
    it('should retrieve record by ID', async () => {
      const created = await persistence.createKey({ name: 'Test' });
      const retrieved = await persistence.getKeyById(created.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('Test');
    });

    it('should return null for non-existent ID', async () => {
      const retrieved = await persistence.getKeyById('non-existent-id');
      expect(retrieved).toBeNull();
    });
  });

  describe('getKeyByValue', () => {
    it('should retrieve by key string', async () => {
      const created = await persistence.createKey({ name: 'Test' });
      const retrieved = await persistence.getKeyByValue(created.key);

      expect(retrieved).toBeDefined();
      expect(retrieved?.key).toBe(created.key);
    });

    it('should return null for non-existent key', async () => {
      const retrieved = await persistence.getKeyByValue('sk-nonexistent');
      expect(retrieved).toBeNull();
    });
  });

  describe('updateKey', () => {
    it('should modify record', async () => {
      const created = await persistence.createKey({ name: 'Original' });
      const updated = await persistence.updateKey(created.id, { name: 'Updated', enabled: false });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated');
      expect(updated?.enabled).toBe(false);
    });

    it('should return null for non-existent ID', async () => {
      const updated = await persistence.updateKey('non-existent', { name: 'Updated' });
      expect(updated).toBeNull();
    });
  });

  describe('deleteKey', () => {
    it('should remove record', async () => {
      const created = await persistence.createKey({ name: 'To Delete' });
      const deleted = await persistence.deleteKey(created.id);

      expect(deleted).toBe(true);

      const retrieved = await persistence.getKeyById(created.id);
      expect(retrieved).toBeNull();
    });

    it('should return false for non-existent ID', async () => {
      const deleted = await persistence.deleteKey('non-existent');
      expect(deleted).toBe(false);
    });
  });

  describe('listKeys', () => {
    it('should return all keys when no filter', async () => {
      await persistence.createKey({ name: 'Key 1' });
      await persistence.createKey({ name: 'Key 2' });
      await persistence.createKey({ name: 'Key 3' });

      const keys = await persistence.listKeys();
      expect(keys).toHaveLength(3);
    });

    it('should filter by teamId', async () => {
      await persistence.createKey({ name: 'Key 1', teamId: 'team-1' });
      await persistence.createKey({ name: 'Key 2', teamId: 'team-2' });
      await persistence.createKey({ name: 'Key 3', teamId: 'team-1' });

      const keys = await persistence.listKeys('team-1');
      expect(keys).toHaveLength(2);
      expect(keys.every((k) => k.teamId === 'team-1')).toBe(true);
    });
  });

  describe('recordUsage', () => {
    it('should increment spend', async () => {
      const created = await persistence.createKey({ name: 'Test' });
      await persistence.recordUsage(created.id, 0.05);

      const retrieved = await persistence.getKeyById(created.id);
      expect(retrieved?.spend).toBe(0.05);
    });

    it('should accumulate spend', async () => {
      const created = await persistence.createKey({ name: 'Test' });
      await persistence.recordUsage(created.id, 0.05);
      await persistence.recordUsage(created.id, 0.03);

      const retrieved = await persistence.getKeyById(created.id);
      expect(retrieved?.spend).toBe(0.08);
    });
  });

  describe('resetSpend', () => {
    it('should reset spend to 0', async () => {
      const created = await persistence.createKey({ name: 'Test' });
      await persistence.recordUsage(created.id, 0.05);
      await persistence.resetSpend(created.id);

      const retrieved = await persistence.getKeyById(created.id);
      expect(retrieved?.spend).toBe(0);
    });
  });
});
