import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminStore } from '../admin-store.js';
import { ModelMappingSchema, type ModelMapping } from '../services/model-mapping.js';

const ModelMappingUpdateSchema = ModelMappingSchema;

export async function modelsRouter(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (_request, _reply) => {
    const mappings = adminStore.getModelMappings();
    const providers = adminStore.getProviders();
    const providerMap = new Map(providers.map((p) => [p.id, p]));

    const enrichedMappings = mappings.map((m) => {
      const provider = providerMap.get(m.providerId);
      return {
        ...m,
        providerType: provider?.type ?? 'unknown',
        providerBaseUrl: provider?.baseUrl ?? '',
      };
    });

    return { mappings: enrichedMappings };
  });

  fastify.put<{ Body: z.infer<typeof ModelMappingUpdateSchema>[] }>('/', async (request, reply) => {
    if (!Array.isArray(request.body)) {
      return reply.status(400).send({
        error: 'Request body must be an array of mappings',
      });
    }

    const mappings = request.body.map((m) => ModelMappingSchema.safeParse(m));
    const invalid = mappings.find((m) => !m.success);

    if (invalid) {
      return reply.status(400).send({
        error: 'Invalid mapping format',
        details: invalid.error?.errors,
      });
    }

    const validMappings = mappings
      .map((m) => m.data)
      .filter((m): m is ModelMapping => m !== undefined);

    for (const mapping of validMappings) {
      const provider = adminStore.getProviderById(mapping.providerId);
      if (!provider) {
        return reply.status(400).send({
          error: `Provider ${mapping.providerId} not found`,
        });
      }
    }

    adminStore.setModelMappings(validMappings);

    return {
      success: true,
      mappings: validMappings,
    };
  });

  fastify.post<{ Body: z.infer<typeof ModelMappingUpdateSchema> }>('/', async (request, reply) => {
    const result = ModelMappingUpdateSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: result.error.errors,
      });
    }

    const { anthropicModel, providerId, providerModel } = result.data;

    const provider = adminStore.getProviderById(providerId);
    if (!provider) {
      return reply.status(400).send({
        error: `Provider ${providerId} not found`,
      });
    }

    const existing = adminStore.getModelMapping(anthropicModel);
    if (existing) {
      return reply.status(400).send({
        error: 'Mapping for this Anthropic model already exists',
      });
    }

    const mapping = adminStore.addModelMapping({
      anthropicModel,
      providerId,
      providerModel,
    });

    return {
      success: true,
      mapping,
    };
  });

  fastify.delete<{ Params: { anthropicModel: string } }>(
    '/:anthropicModel',
    async (request, reply) => {
      const { anthropicModel } = request.params;

      const existing = adminStore.getModelMapping(anthropicModel);
      if (!existing) {
        return reply.status(404).send({
          error: 'Mapping not found',
        });
      }

      const deleted = adminStore.deleteModelMapping(anthropicModel);
      if (!deleted) {
        return reply.status(500).send({
          error: 'Failed to delete mapping',
        });
      }

      return {
        success: true,
        message: `Mapping for ${anthropicModel} deleted`,
      };
    }
  );
}
