import { FastifyInstance } from 'fastify';
import { adminStore } from '../admin-store.js';

export async function tracesRouter(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;
    const log = adminStore.getLogById(id);

    if (!log) {
      return reply.status(404).send({
        error: 'Trace not found',
      });
    }

    return {
      trace: {
        request_id: log.id,
        timestamp: log.timestamp,
        method: log.method,
        url: log.url,
        status: log.status,
        latency_ms: log.latencyMs,
        provider: log.provider,
        model: log.model,
        steps: [
          {
            name: 'Anthropic Request',
            data: log.anthropicRequest,
          },
          ...(log.normalizedRequest
            ? [
                {
                  name: 'Normalized Request',
                  data: log.normalizedRequest,
                },
              ]
            : []),
          ...(log.openaiRequest
            ? [
                {
                  name: 'OpenAI Request',
                  data: log.openaiRequest,
                },
              ]
            : []),
          ...(log.providerResponse
            ? [
                {
                  name: 'Provider Response',
                  data: log.providerResponse,
                },
              ]
            : []),
          ...(log.anthropicResponse
            ? [
                {
                  name: 'Anthropic Response',
                  data: log.anthropicResponse,
                },
              ]
            : []),
        ],
        ...(log.error
          ? {
              error: log.error,
            }
          : {}),
      },
    };
  });
}
