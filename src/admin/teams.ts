import { FastifyInstance } from 'fastify';
import { tenancyService } from '../services/tenancy/index.js';

export async function registerTeamsRouter(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (request, _reply) => {
    const query = request.query as { organizationId?: string } | undefined;
    const teams = await tenancyService.listTeams(query?.organizationId);
    return { teams };
  });

  fastify.get('/:id', async (request, _reply) => {
    const { id } = request.params as { id: string };
    const team = await tenancyService.getTeam(id);
    if (!team) {
      throw { statusCode: 404, message: 'Team not found' };
    }
    return { team };
  });

  fastify.post('/', async (request, _reply) => {
    const body = request.body as {
      name: string;
      organizationId?: string;
      description?: string;
      budget?: number;
      budgetResetAt?: string;
      metadata?: Record<string, unknown>;
    };
    const team = await tenancyService.createTeam({
      name: body.name,
      organizationId: body.organizationId,
      description: body.description,
      budget: body.budget,
      budgetResetAt: body.budgetResetAt,
      metadata: body.metadata,
    });
    return { team };
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
    const team = await tenancyService.updateTeam(id, {
      name: body.name,
      description: body.description,
      budget: body.budget,
      budgetResetAt: body.budgetResetAt,
      metadata: body.metadata,
    });
    if (!team) {
      throw { statusCode: 404, message: 'Team not found' };
    }
    return { team };
  });

  fastify.delete('/:id', async (request, _reply) => {
    const { id } = request.params as { id: string };
    await tenancyService.deleteTeam(id);
    return { success: true };
  });

  fastify.get('/:id/stats', async (request, _reply) => {
    const { id } = request.params as { id: string };
    const team = await tenancyService.getTeam(id);
    if (!team) {
      throw { statusCode: 404, message: 'Team not found' };
    }

    const users = await tenancyService.listUsers(undefined, id);
    const apiKeys = await tenancyService.listApiKeys({ teamId: id });

    return {
      team: {
        id: team.id,
        name: team.name,
        spend: team.spend,
        budget: team.budget,
        requestCount: team.requestCount,
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

export const teamsRouter = registerTeamsRouter;
