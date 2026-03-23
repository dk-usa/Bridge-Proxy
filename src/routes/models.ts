import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { adminStore } from '../admin-store.js';

export async function modelsRouter(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: { limit?: number; after?: string } }>(
    '/models',
    async (
      request: FastifyRequest<{ Querystring: { limit?: number; after?: string } }>,
      _reply: FastifyReply
    ) => {
      const mappings = adminStore.getModelMappings();

      let models = mappings.map((m) => ({
        id: m.anthropicModel,
        object: 'model' as const,
        created: null,
        owned_by: m.providerId,
        provider_model: m.providerModel,
        provider_id: m.providerId,
      }));

      const { limit = 100, after } = request.query;

      if (after) {
        const afterIndex = models.findIndex((m) => m.id === after);
        if (afterIndex !== -1) {
          models = models.slice(afterIndex + 1);
        }
      }

      if (limit) {
        models = models.slice(0, limit);
      }

      return {
        object: 'list',
        data: models.map((model) => ({
          id: model.id,
          object: model.object,
          created: model.created,
          owned_by: model.owned_by,
        })),
        first_id: models[0]?.id,
        last_id: models[models.length - 1]?.id,
        has_more: false,
      };
    }
  );

  fastify.get<{ Params: { model: string } }>(
    '/models/:model',
    async (request: FastifyRequest<{ Params: { model: string } }>, reply: FastifyReply) => {
      const { model } = request.params;

      const mapping = adminStore.getModelMapping(model);

      if (!mapping) {
        return reply.status(404).send({
          error: {
            message: `Model '${model}' not found`,
            type: 'invalid_request_error',
          },
        });
      }

      return {
        id: mapping.anthropicModel,
        object: 'model',
        created: null,
        owned_by: mapping.providerId,
        provider_model: mapping.providerModel,
        provider_id: mapping.providerId,
      };
    }
  );
}
