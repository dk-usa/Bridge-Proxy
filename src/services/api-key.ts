import { z } from 'zod';
import crypto from 'crypto';

export const ApiKeySchema = z.object({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  description: z.string().optional(),
  teamId: z.string().optional(),
  providerId: z.string().optional(),
  modelRestrictions: z.array(z.string()).optional(),
  budget: z.number().nullable(),
  budgetResetAt: z.string().optional(),
  spend: z.number().default(0),
  requestCount: z.number().default(0),
  rateLimit: z.number().optional(),
  enabled: z.boolean().default(true),
  createdAt: z.string(),
  expiresAt: z.string().nullable(),
  lastUsedAt: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type ApiKey = z.infer<typeof ApiKeySchema>;

export const TeamSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  budget: z.number().nullable(),
  spend: z.number().default(0),
  requestCount: z.number().default(0),
  members: z.array(z.string()).optional(),
  createdAt: z.string(),
});

export type Team = z.infer<typeof TeamSchema>;

const KEY_PREFIX = 'sk-';

function generateKey(): string {
  return `${KEY_PREFIX}${crypto.randomBytes(32).toString('hex')}`;
}

function generateId(): string {
  return crypto.randomUUID();
}

class ApiKeyService {
  private keys: Map<string, ApiKey> = new Map();
  private keyByKeyValue: Map<string, string> = new Map();
  private teams: Map<string, Team> = new Map();

  createKey(options: {
    name: string;
    description?: string;
    teamId?: string;
    providerId?: string;
    modelRestrictions?: string[];
    budget?: number | null;
    budgetResetAt?: string;
    rateLimit?: number;
    expiresInDays?: number | null;
    metadata?: Record<string, unknown>;
    key?: string;
  }): ApiKey {
    const id = generateId();
    const key = options.key && options.key.startsWith(KEY_PREFIX) ? options.key : generateKey();
    const now = new Date().toISOString();

    let expiresAt: string | null = null;
    if (options.expiresInDays && options.expiresInDays > 0) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + options.expiresInDays);
      expiresAt = expiryDate.toISOString();
    }

    const apiKey: ApiKey = {
      id,
      key,
      name: options.name,
      description: options.description,
      teamId: options.teamId,
      providerId: options.providerId,
      modelRestrictions: options.modelRestrictions,
      budget: options.budget ?? null,
      budgetResetAt: options.budgetResetAt,
      spend: 0,
      requestCount: 0,
      rateLimit: options.rateLimit,
      enabled: true,
      createdAt: now,
      expiresAt,
      metadata: options.metadata,
    };

    this.keys.set(id, apiKey);
    this.keyByKeyValue.set(key, id);

    return apiKey;
  }

  validateKey(key: string): ApiKey | null {
    if (!key.startsWith(KEY_PREFIX)) {
      return null;
    }

    const id = this.keyByKeyValue.get(key);
    if (!id) {
      return null;
    }

    const apiKey = this.keys.get(id);
    if (!apiKey) {
      return null;
    }

    if (!apiKey.enabled) {
      return null;
    }

    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return null;
    }

    if (apiKey.budget !== null && apiKey.spend >= apiKey.budget) {
      return null;
    }

    return apiKey;
  }

  getKey(id: string): ApiKey | undefined {
    return this.keys.get(id);
  }

  getKeyByValue(key: string): ApiKey | undefined {
    const id = this.keyByKeyValue.get(key);
    return id ? this.keys.get(id) : undefined;
  }

  listKeys(teamId?: string): ApiKey[] {
    const allKeys = Array.from(this.keys.values());
    if (teamId) {
      return allKeys.filter((k) => k.teamId === teamId);
    }
    return allKeys;
  }

  updateKey(id: string, updates: Partial<Omit<ApiKey, 'id' | 'key' | 'createdAt'>>): ApiKey | null {
    const key = this.keys.get(id);
    if (!key) {
      return null;
    }

    const updated = { ...key, ...updates };
    this.keys.set(id, updated);

    return updated;
  }

  deleteKey(id: string): boolean {
    const key = this.keys.get(id);
    if (!key) {
      return false;
    }

    this.keyByKeyValue.delete(key.key);
    this.keys.delete(id);
    return true;
  }

  recordUsage(keyId: string, cost: number): void {
    const key = this.keys.get(keyId);
    if (!key) return;

    key.spend += cost;
    key.requestCount += 1;
    key.lastUsedAt = new Date().toISOString();

    if (key.teamId) {
      const team = this.teams.get(key.teamId);
      if (team) {
        team.spend += cost;
        team.requestCount += 1;
      }
    }
  }

  createTeam(options: { name: string; description?: string; budget?: number | null }): Team {
    const id = generateId();
    const now = new Date().toISOString();

    const team: Team = {
      id,
      name: options.name,
      description: options.description,
      budget: options.budget ?? null,
      spend: 0,
      requestCount: 0,
      createdAt: now,
    };

    this.teams.set(id, team);
    return team;
  }

  getTeam(id: string): Team | undefined {
    return this.teams.get(id);
  }

  listTeams(): Team[] {
    return Array.from(this.teams.values());
  }

  updateTeam(id: string, updates: Partial<Omit<Team, 'id' | 'createdAt'>>): Team | null {
    const team = this.teams.get(id);
    if (!team) {
      return null;
    }

    const updated = { ...team, ...updates };
    this.teams.set(id, updated);
    return updated;
  }

  deleteTeam(id: string): boolean {
    return this.teams.delete(id);
  }

  resetSpend(keyId?: string, teamId?: string): void {
    if (keyId) {
      const key = this.keys.get(keyId);
      if (key) {
        key.spend = 0;
        key.requestCount = 0;
      }
    } else if (teamId) {
      const team = this.teams.get(teamId);
      if (team) {
        team.spend = 0;
        team.requestCount = 0;
      }
      for (const key of this.keys.values()) {
        if (key.teamId === teamId) {
          key.spend = 0;
          key.requestCount = 0;
        }
      }
    }
  }

  getStats(): { totalKeys: number; totalTeams: number; totalSpend: number; totalRequests: number } {
    let totalSpend = 0;
    let totalRequests = 0;

    for (const key of this.keys.values()) {
      totalSpend += key.spend;
      totalRequests += key.requestCount;
    }

    return {
      totalKeys: this.keys.size,
      totalTeams: this.teams.size,
      totalSpend,
      totalRequests,
    };
  }

  importKeys(keys: ApiKey[]): void {
    for (const key of keys) {
      this.keys.set(key.id, key);
      this.keyByKeyValue.set(key.key, key.id);
    }
  }

  importTeams(teams: Team[]): void {
    for (const team of teams) {
      this.teams.set(team.id, team);
    }
  }
}

export const apiKeyService = new ApiKeyService();
