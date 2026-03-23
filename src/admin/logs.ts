import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminStore } from '../admin-store.js';

const LogsQuerySchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  status: z.enum(['success', 'error']).optional(),
  provider: z.string().optional(),
  model: z.string().optional(),
  search: z.string().optional(),
});

export async function logsRouter(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (request, _reply) => {
    const result = LogsQuerySchema.safeParse(request.query);
    if (!result.success) {
      return {
        error: 'Invalid query parameters',
        details: result.error.errors,
      };
    }

    const logs = adminStore.getLogs({
      limit: result.data.limit,
      offset: result.data.offset,
      status: result.data.status,
      provider: result.data.provider,
      model: result.data.model,
      search: result.data.search,
    });

    return logs;
  });

  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const log = adminStore.getLogById(id);

    if (!log) {
      return reply.status(404).send({
        error: 'Log not found',
      });
    }

    return { log };
  });

  fastify.delete('/', async (_request, _reply) => {
    adminStore.clearLogs();
    return {
      success: true,
      message: 'Logs cleared',
    };
  });
}
