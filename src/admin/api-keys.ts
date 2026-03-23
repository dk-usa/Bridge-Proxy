import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { apiKeyService } from '../services/index.js';
import { getLogger } from '../config/index.js';

const CreateKeySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  teamId: z.string().optional(),
  providerId: z.string().optional(),
  modelRestrictions: z.array(z.string()).optional(),
  budget: z.number().nullable().optional(),
  rateLimit: z.number().optional(),
  expiresInDays: z.number().nullable().optional(),
  key: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateKeySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  teamId: z.string().optional(),
  providerId: z.string().optional(),
  modelRestrictions: z.array(z.string()).optional(),
  budget: z.number().nullable().optional(),
  rateLimit: z.number().optional(),
  enabled: z.boolean().optional(),
  expiresAt: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function apiKeysRouter(fastify: FastifyInstance): Promise<void> {
  fastify.get('/keys', async (_request, _reply) => {
    const keys = apiKeyService.listKeys();
    return { keys };
  });

  fastify.get('/keys/:id', async (request, _reply) => {
    const { id } = request.params as { id: string };
    const key = apiKeyService.getKey(id);
    if (!key) {
      return _reply.status(404).send({ error: 'Key not found' });
    }
    return { key };
  });

  fastify.post('/keys', async (request, _reply) => {
    const logger = getLogger();
    logger.info({ body: request.body }, 'Creating API key');

    const result = CreateKeySchema.safeParse(request.body);
    if (!result.success) {
      logger.error({ error: result.error.errors }, 'Validation failed');
      return _reply.status(400).send({ error: result.error.errors });
    }

    try {
      const key = apiKeyService.createKey(result.data);
      logger.info({ keyId: key.id }, 'API key created');
      return { key };
    } catch (error) {
      logger.error({ error }, 'Failed to create API key');
      return _reply.status(500).send({ error: 'Failed to create API key' });
    }
  });

  fastify.put('/keys/:id', async (request, _reply) => {
    const { id } = request.params as { id: string };
    const result = UpdateKeySchema.safeParse(request.body);
    if (!result.success) {
      return _reply.status(400).send({ error: result.error.errors });
    }

    const key = apiKeyService.updateKey(id, result.data);
    if (!key) {
      return _reply.status(404).send({ error: 'Key not found' });
    }
    return { key };
  });

  fastify.delete('/keys/:id', async (request, _reply) => {
    const { id } = request.params as { id: string };
    const deleted = apiKeyService.deleteKey(id);
    if (!deleted) {
      return _reply.status(404).send({ error: 'Key not found' });
    }
    return { success: true };
  });

  fastify.post('/keys/:id/rotate', async (request, _reply) => {
    const { id } = request.params as { id: string };
    const key = apiKeyService.getKey(id);
    if (!key) {
      return _reply.status(404).send({ error: 'Key not found' });
    }

    const newKey = apiKeyService.createKey({
      name: key.name,
      description: key.description,
      teamId: key.teamId,
      providerId: key.providerId,
      modelRestrictions: key.modelRestrictions,
      budget: key.budget,
      rateLimit: key.rateLimit,
    });

    apiKeyService.deleteKey(id);
    return { key: newKey };
  });

  fastify.post('/keys/:id/reset-spend', async (request, _reply) => {
    const { id } = request.params as { id: string };
    apiKeyService.resetSpend(id);
    const key = apiKeyService.getKey(id);
    return { key };
  });

  fastify.get('/stats', async (_request, _reply) => {
    const stats = apiKeyService.getStats();
    return { stats };
  });
}
