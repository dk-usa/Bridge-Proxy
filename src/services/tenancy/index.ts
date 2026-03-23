import { db } from '../../db/index.js';
import { organizations, teams, users, apiKeys } from '../../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { createHash, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

export interface CreateOrgOptions {
  name: string;
  description?: string;
  budget?: number;
  budgetResetAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateTeamOptions {
  name: string;
  organizationId?: string;
  description?: string;
  budget?: number;
  budgetResetAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateUserOptions {
  name: string;
  email: string;
  organizationId?: string;
  teamId?: string;
  budget?: number;
  budgetResetAt?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateApiKeyOptions {
  name: string;
  description?: string;
  userId?: string;
  teamId?: string;
  organizationId?: string;
  modelRestrictions?: string[];
  budget?: number;
  budgetResetAt?: string;
  rateLimit?: number;
  expiresInDays?: number;
  metadata?: Record<string, unknown>;
}

export interface ApiKeyValidation {
  valid: boolean;
  reason?: string;
  apiKey?: typeof apiKeys.$inferSelect;
  organization?: typeof organizations.$inferSelect;
  team?: typeof teams.$inferSelect;
  user?: typeof users.$inferSelect;
}

export class TenancyService {
  async createOrganization(options: CreateOrgOptions) {
    const id = randomBytes(16).toString('hex');
    const result = await db
      .insert(organizations)
      .values({
        id,
        name: options.name,
        description: options.description,
        budget: options.budget,
        budgetResetAt: options.budgetResetAt,
        metadata: options.metadata,
      })
      .returning();
    return result[0];
  }

  async getOrganization(id: string) {
    const result = await db.select().from(organizations).where(eq(organizations.id, id));
    return result[0];
  }

  async listOrganizations() {
    return db.select().from(organizations).orderBy(desc(organizations.createdAt));
  }

  async updateOrganization(id: string, updates: Partial<CreateOrgOptions>) {
    const result = await db
      .update(organizations)
      .set(updates)
      .where(eq(organizations.id, id))
      .returning();
    return result[0];
  }

  async deleteOrganization(id: string) {
    await db.delete(organizations).where(eq(organizations.id, id));
  }

  async createTeam(options: CreateTeamOptions) {
    const id = randomBytes(16).toString('hex');
    const result = await db
      .insert(teams)
      .values({
        id,
        name: options.name,
        organizationId: options.organizationId,
        description: options.description,
        budget: options.budget,
        budgetResetAt: options.budgetResetAt,
        metadata: options.metadata,
      })
      .returning();
    return result[0];
  }

  async getTeam(id: string) {
    const result = await db.select().from(teams).where(eq(teams.id, id));
    return result[0];
  }

  async listTeams(organizationId?: string) {
    if (organizationId) {
      return db
        .select()
        .from(teams)
        .where(eq(teams.organizationId, organizationId))
        .orderBy(desc(teams.createdAt));
    }
    return db.select().from(teams).orderBy(desc(teams.createdAt));
  }

  async updateTeam(id: string, updates: Partial<CreateTeamOptions>) {
    const result = await db.update(teams).set(updates).where(eq(teams.id, id)).returning();
    return result[0];
  }

  async deleteTeam(id: string) {
    await db.delete(teams).where(eq(teams.id, id));
  }

  async createUser(options: CreateUserOptions) {
    const id = randomBytes(16).toString('hex');
    const result = await db
      .insert(users)
      .values({
        id,
        name: options.name,
        email: options.email,
        organizationId: options.organizationId,
        teamId: options.teamId,
        budget: options.budget,
        budgetResetAt: options.budgetResetAt,
        metadata: options.metadata,
      })
      .returning();
    return result[0];
  }

  async getUser(id: string) {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0];
  }

  async getUserByEmail(email: string) {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }

  async listUsers(organizationId?: string, teamId?: string) {
    const query = db.select().from(users);

    if (organizationId && teamId) {
      return db
        .select()
        .from(users)
        .where(and(eq(users.organizationId, organizationId), eq(users.teamId, teamId)))
        .orderBy(desc(users.createdAt));
    } else if (organizationId) {
      return db
        .select()
        .from(users)
        .where(eq(users.organizationId, organizationId))
        .orderBy(desc(users.createdAt));
    } else if (teamId) {
      return db.select().from(users).where(eq(users.teamId, teamId)).orderBy(desc(users.createdAt));
    }

    return query.orderBy(desc(users.createdAt));
  }

  async updateUser(id: string, updates: Partial<CreateUserOptions>) {
    const result = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return result[0];
  }

  async deleteUser(id: string) {
    await db.delete(users).where(eq(users.id, id));
  }

  private async encryptKey(key: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derivedKey = (await scryptAsync(key, salt, 32)) as Buffer;
    return `${salt}:${derivedKey.toString('hex')}`;
  }

  async createApiKey(
    options: CreateApiKeyOptions
  ): Promise<{ key: string; apiKey: typeof apiKeys.$inferSelect }> {
    const id = randomBytes(16).toString('hex');
    const rawKey = `sk-${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyValueEncrypted = await this.encryptKey(rawKey);

    let expiresAt: string | null = null;
    if (options.expiresInDays && options.expiresInDays > 0) {
      const expiryDate = new Date();
      expiryDate.setDate(expiryDate.getDate() + options.expiresInDays);
      expiresAt = expiryDate.toISOString();
    }

    const result = await db
      .insert(apiKeys)
      .values({
        id,
        keyHash,
        keyValueEncrypted,
        name: options.name,
        description: options.description,
        userId: options.userId,
        teamId: options.teamId,
        organizationId: options.organizationId,
        modelRestrictions: options.modelRestrictions,
        budget: options.budget,
        budgetResetAt: options.budgetResetAt,
        rateLimit: options.rateLimit,
        expiresAt,
        metadata: options.metadata,
      })
      .returning();

    return { key: rawKey, apiKey: result[0] };
  }

  async validateApiKey(rawKey: string): Promise<ApiKeyValidation> {
    if (!rawKey.startsWith('sk-')) {
      return { valid: false, reason: 'Invalid key format' };
    }

    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const result = await db.select().from(apiKeys).where(eq(apiKeys.keyHash, keyHash));

    if (!result[0]) {
      return { valid: false, reason: 'API key not found' };
    }

    const apiKey = result[0];

    if (!apiKey.enabled) {
      return { valid: false, reason: 'API key is disabled' };
    }

    if (apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date()) {
      return { valid: false, reason: 'API key has expired' };
    }

    if (
      apiKey.budget !== null &&
      apiKey.budget !== undefined &&
      (apiKey.spend ?? 0) >= apiKey.budget
    ) {
      return { valid: false, reason: 'Budget exceeded', apiKey };
    }

    let organization: typeof organizations.$inferSelect | undefined;
    let team: typeof teams.$inferSelect | undefined;
    let user: typeof users.$inferSelect | undefined;

    if (apiKey.organizationId) {
      const orgResult = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, apiKey.organizationId));
      organization = orgResult[0];

      if (organization && !organization.enabled) {
        return { valid: false, reason: 'Organization is disabled', apiKey };
      }
      if (
        organization &&
        organization.budget !== null &&
        (organization.spend ?? 0) >= organization.budget
      ) {
        return { valid: false, reason: 'Organization budget exceeded', apiKey, organization };
      }
    }

    if (apiKey.teamId) {
      const teamResult = await db.select().from(teams).where(eq(teams.id, apiKey.teamId));
      team = teamResult[0];

      if (team && !team.enabled) {
        return { valid: false, reason: 'Team is disabled', apiKey };
      }
      if (team && team.budget !== null && (team.spend ?? 0) >= team.budget) {
        return { valid: false, reason: 'Team budget exceeded', apiKey, team };
      }
    }

    if (apiKey.userId) {
      const userResult = await db.select().from(users).where(eq(users.id, apiKey.userId));
      user = userResult[0];

      if (user && !user.enabled) {
        return { valid: false, reason: 'User is disabled', apiKey };
      }
      if (user && user.budget !== null && (user.spend ?? 0) >= user.budget) {
        return { valid: false, reason: 'User budget exceeded', apiKey, user };
      }
    }

    await db
      .update(apiKeys)
      .set({ lastUsedAt: new Date().toISOString() })
      .where(eq(apiKeys.id, apiKey.id));

    return { valid: true, apiKey, organization, team, user };
  }

  async recordUsage(apiKeyId: string, cost: number): Promise<void> {
    await db
      .update(apiKeys)
      .set({
        spend: db
          .select()
          .from(apiKeys)
          .where(eq(apiKeys.id, apiKeyId))
          .then((r) => r[0]?.spend || 0)
          .catch(() => 0) as any,
      })
      .where(eq(apiKeys.id, apiKeyId));

    const keyResult = await db.select().from(apiKeys).where(eq(apiKeys.id, apiKeyId));
    if (keyResult[0]) {
      await db
        .update(apiKeys)
        .set({
          spend: (keyResult[0].spend || 0) + cost,
          requestCount: (keyResult[0].requestCount || 0) + 1,
        })
        .where(eq(apiKeys.id, apiKeyId));
    }

    if (keyResult[0]?.teamId) {
      const teamResult = await db.select().from(teams).where(eq(teams.id, keyResult[0].teamId));
      if (teamResult[0]) {
        await db
          .update(teams)
          .set({
            spend: (teamResult[0].spend || 0) + cost,
            requestCount: (teamResult[0].requestCount || 0) + 1,
          })
          .where(eq(teams.id, keyResult[0].teamId));
      }
    }

    if (keyResult[0]?.organizationId) {
      const orgResult = await db
        .select()
        .from(organizations)
        .where(eq(organizations.id, keyResult[0].organizationId));
      if (orgResult[0]) {
        await db
          .update(organizations)
          .set({
            spend: (orgResult[0].spend || 0) + cost,
            requestCount: (orgResult[0].requestCount || 0) + 1,
          })
          .where(eq(organizations.id, keyResult[0].organizationId));
      }
    }
  }

  async resetSpend(apiKeyId?: string, teamId?: string, organizationId?: string): Promise<void> {
    if (apiKeyId) {
      await db.update(apiKeys).set({ spend: 0, requestCount: 0 }).where(eq(apiKeys.id, apiKeyId));
    }
    if (teamId) {
      await db.update(teams).set({ spend: 0, requestCount: 0 }).where(eq(teams.id, teamId));

      await db.update(apiKeys).set({ spend: 0, requestCount: 0 }).where(eq(apiKeys.teamId, teamId));
    }
    if (organizationId) {
      await db
        .update(organizations)
        .set({ spend: 0, requestCount: 0 })
        .where(eq(organizations.id, organizationId));

      await db
        .update(teams)
        .set({ spend: 0, requestCount: 0 })
        .where(eq(teams.organizationId, organizationId));

      await db
        .update(apiKeys)
        .set({ spend: 0, requestCount: 0 })
        .where(eq(apiKeys.organizationId, organizationId));
    }
  }

  async listApiKeys(options?: { teamId?: string; organizationId?: string; userId?: string }) {
    const conditions = [];
    if (options?.teamId) conditions.push(eq(apiKeys.teamId, options.teamId));
    if (options?.organizationId)
      conditions.push(eq(apiKeys.organizationId, options.organizationId));
    if (options?.userId) conditions.push(eq(apiKeys.userId, options.userId));

    if (conditions.length > 0) {
      return db
        .select()
        .from(apiKeys)
        .where(and(...conditions))
        .orderBy(desc(apiKeys.createdAt));
    }
    return db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  }

  async getApiKey(id: string) {
    const result = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
    return result[0];
  }

  async updateApiKey(id: string, updates: Partial<CreateApiKeyOptions>) {
    const result = await db.update(apiKeys).set(updates).where(eq(apiKeys.id, id)).returning();
    return result[0];
  }

  async deleteApiKey(id: string) {
    await db.delete(apiKeys).where(eq(apiKeys.id, id));
  }

  async rotateApiKey(id: string): Promise<{ key: string; apiKey: typeof apiKeys.$inferSelect }> {
    const rawKey = `sk-${randomBytes(32).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const keyValueEncrypted = await this.encryptKey(rawKey);

    const result = await db
      .update(apiKeys)
      .set({ keyHash, keyValueEncrypted })
      .where(eq(apiKeys.id, id))
      .returning();

    return { key: rawKey, apiKey: result[0] };
  }
}

export const tenancyService = new TenancyService();
