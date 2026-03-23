import { FastifyInstance } from 'fastify';
import { tenancyService } from '../services/tenancy/index.js';

export async function registerUsersRouter(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (request, _reply) => {
    const query = request.query as { organizationId?: string; teamId?: string } | undefined;
    const users = await tenancyService.listUsers(query?.organizationId, query?.teamId);
    return { users };
  });

  fastify.get('/:id', async (request, _reply) => {
    const { id } = request.params as { id: string };
    const user = await tenancyService.getUser(id);
    if (!user) {
      throw { statusCode: 404, message: 'User not found' };
    }
    return { user };
  });

  fastify.post('/', async (request, _reply) => {
    const body = request.body as {
      name: string;
      email: string;
      organizationId?: string;
      teamId?: string;
      budget?: number;
      budgetResetAt?: string;
      metadata?: Record<string, unknown>;
    };
    const user = await tenancyService.createUser({
      name: body.name,
      email: body.email,
      organizationId: body.organizationId,
      teamId: body.teamId,
      budget: body.budget,
      budgetResetAt: body.budgetResetAt,
      metadata: body.metadata,
    });
    return { user };
  });

  fastify.put('/:id', async (request, _reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      name?: string;
      email?: string;
      teamId?: string;
      budget?: number;
      budgetResetAt?: string;
      enabled?: boolean;
      metadata?: Record<string, unknown>;
    };
    const user = await tenancyService.updateUser(id, {
      name: body.name,
      email: body.email,
      teamId: body.teamId,
      budget: body.budget,
      budgetResetAt: body.budgetResetAt,
      metadata: body.metadata,
    });
    if (!user) {
      throw { statusCode: 404, message: 'User not found' };
    }
    return { user };
  });

  fastify.delete('/:id', async (request, _reply) => {
    const { id } = request.params as { id: string };
    await tenancyService.deleteUser(id);
    return { success: true };
  });
}

export const usersRouter = registerUsersRouter;
