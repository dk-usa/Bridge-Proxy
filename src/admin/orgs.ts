import { FastifyInstance } from 'fastify';
import { tenancyService } from '../services/tenancy/index.js';

export async function registerOrgsRouter(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (_request, _reply) => {
    const organizations = await tenancyService.listOrganizations();
    return { organizations };
  });

  fastify.get('/:id', async (request, _reply) => {
    const { id } = request.params as { id: string };
    const organization = await tenancyService.getOrganization(id);
    if (!organization) {
      throw { statusCode: 404, message: 'Organization not found' };
    }
    return { organization };
  });

  fastify.post('/', async (request, _reply) => {
    const body = request.body as {
      name: string;
      description?: string;
      budget?: number;
      budgetResetAt?: string;
      metadata?: Record<string, unknown>;
    };
    const organization = await tenancyService.createOrganization({
      name: body.name,
      description: body.description,
      budget: body.budget,
      budgetResetAt: body.budgetResetAt,
      metadata: body.metadata,
    });
    return { organization };
  });

  fastify.put('/:id', async (request, _reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      description?: string;
      budget?: number;
      budgetResetAt?: string;
      enabled?: boolean;
      metadata?: Record<string, unknown>;
    };
    const organization = await tenancyService.updateOrganization(id, {
      name: body.name,
      description: body.description,
      budget: body.budget,
      budgetResetAt: body.budgetResetAt,
      metadata: body.metadata,
    });
    if (!organization) {
      throw { statusCode: 404, message: 'Organization not found' };
    }
    return { organization };
  });

  fastify.delete('/:id', async (request, _reply) => {
    const { id } = request.params as { id: string };
    await tenancyService.deleteOrganization(id);
    return { success: true };
  });

  fastify.get('/:id/stats', async (request, _reply) => {
    const { id } = request.params as { id: string };
    const organization = await tenancyService.getOrganization(id);
    if (!organization) {
      throw { statusCode: 404, message: 'Organization not found' };
    }

    const teams = await tenancyService.listTeams(id);
    const users = await tenancyService.listUsers(id);
    const apiKeys = await tenancyService.listApiKeys({ organizationId: id });

    return {
      organization: {
        id: organization.id,
        name: organization.name,
        spend: organization.spend,
        budget: organization.budget,
        requestCount: organization.requestCount,
      },
      teams: {
        count: teams.length,
        totalSpend: teams.reduce((acc, t) => acc + (t.spend ?? 0), 0),
      },
      users: {
        count: users.length,
        totalSpend: users.reduce((acc, u) => acc + (u.spend ?? 0), 0),
      },
      apiKeys: {
        count: apiKeys.length,
        totalSpend: apiKeys.reduce((acc, k) => acc + (k.spend ?? 0), 0),
      },
    };
  });
}

export const orgsRouter = registerOrgsRouter;
