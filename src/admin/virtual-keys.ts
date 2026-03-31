import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getVirtualKeyService } from '../virtual-keys/service.js';
import { getKeyRotationService } from '../virtual-keys/rotation.js';
import { getLogger } from '../config/index.js';

// Zod schemas for validation
const CreateVirtualKeySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  teamId: z.string().optional(),
  orgId: z.string().optional(),
  models: z.array(z.string()).optional(),
  maxBudget: z.number().positive().optional(),
  budgetDuration: z.enum(['30d', '1m']).optional(),
  rpmLimit: z.number().int().positive().optional(),
  tpmLimit: z.number().int().positive().optional(),
  expiresInDays: z.number().int().positive().optional(),
  rotationEnabled: z.boolean().optional(),
  rotationIntervalDays: z.number().int().positive().optional(),
  metadata: z.record(z.unknown()).optional(),
});

const UpdateVirtualKeySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  teamId: z.string().optional(),
  orgId: z.string().optional(),
  models: z.array(z.string()).optional(),
  maxBudget: z.number().positive().nullable().optional(),
  budgetDuration: z.enum(['30d', '1m']).optional(),
  rpmLimit: z.number().int().positive().nullable().optional(),
  tpmLimit: z.number().int().positive().nullable().optional(),
  enabled: z.boolean().optional(),
  expiresAt: z.string().nullable().optional(),
  rotationEnabled: z.boolean().optional(),
  rotationIntervalDays: z.number().int().positive().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

/**
 * Admin API routes for virtual key management.
 *
 * Per plan 05-05: Full CRUD for virtual keys with rotation support.
 */
export async function virtualKeysRoutes(fastify: FastifyInstance): Promise<void> {
  const logger = getLogger();

  // GET /admin/virtual-keys - List all virtual keys
  fastify.get('/virtual-keys', async (request, _reply) => {
    const { teamId } = request.query as { teamId?: string };
    const service = getVirtualKeyService();
    const keys = await service.listKeys(teamId);
    return { keys };
  });

  // GET /admin/virtual-keys/:id - Get a specific virtual key
  fastify.get<{ Params: { id: string } }>('/virtual-keys/:id', async (request, reply) => {
    const { id } = request.params;
    const service = getVirtualKeyService();
    const key = await service.persistence.getKeyById(id);
    if (!key) {
      return reply.status(404).send({ error: 'Virtual key not found' });
    }
    return { key };
  });

  // POST /admin/virtual-keys - Create a new virtual key
  fastify.post('/virtual-keys', async (request, reply) => {
    const result = CreateVirtualKeySchema.safeParse(request.body);
    if (!result.success) {
      logger.error({ error: result.error.errors }, 'Validation failed for virtual key creation');
      return reply
        .status(400)
        .send({ error: 'Invalid request body', details: result.error.errors });
    }

    try {
      const service = getVirtualKeyService();
      const key = await service.createKey(result.data);
      logger.info({ keyId: key.id, name: key.name }, 'Virtual key created');
      return reply.status(201).send({ key });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to create virtual key');
      return reply.status(500).send({ error: 'Failed to create virtual key' });
    }
  });

  // PUT /admin/virtual-keys/:id - Update a virtual key
  fastify.put<{ Params: { id: string } }>('/virtual-keys/:id', async (request, reply) => {
    const { id } = request.params;
    const result = UpdateVirtualKeySchema.safeParse(request.body);
    if (!result.success) {
      return reply
        .status(400)
        .send({ error: 'Invalid request body', details: result.error.errors });
    }

    try {
      const service = getVirtualKeyService();
      // Transform null to undefined for optional fields
      const updates = Object.fromEntries(
        Object.entries(result.data).map(([k, v]) => [k, v === null ? undefined : v])
      );
      const key = await service.updateKey(id, updates);
      if (!key) {
        return reply.status(404).send({ error: 'Virtual key not found' });
      }
      logger.info({ keyId: id }, 'Virtual key updated');
      return { key };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to update virtual key');
      return reply.status(500).send({ error: 'Failed to update virtual key' });
    }
  });

  // DELETE /admin/virtual-keys/:id - Delete a virtual key
  fastify.delete<{ Params: { id: string } }>('/virtual-keys/:id', async (request, reply) => {
    const { id } = request.params;
    const service = getVirtualKeyService();
    const deleted = await service.deleteKey(id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Virtual key not found' });
    }
    logger.info({ keyId: id }, 'Virtual key deleted');
    return { success: true, message: `Virtual key ${id} deleted` };
  });

  // POST /admin/virtual-keys/:id/rotate - Rotate a key
  fastify.post<{ Params: { id: string } }>('/virtual-keys/:id/rotate', async (request, reply) => {
    const { id } = request.params;
    try {
      const rotationService = getKeyRotationService();
      const result = await rotationService.rotateKey(id);
      logger.info({ oldKeyId: id, newKeyId: result.newKey.id }, 'Virtual key rotated');
      return {
        newKey: result.newKey,
        oldKey: result.oldKey,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage === 'Key not found') {
        return reply.status(404).send({ error: 'Virtual key not found' });
      }
      logger.error({ error: errorMessage }, 'Failed to rotate virtual key');
      return reply.status(500).send({ error: 'Failed to rotate virtual key' });
    }
  });

  // POST /admin/virtual-keys/:id/reset-spend - Reset spend counter
  fastify.post<{ Params: { id: string } }>(
    '/virtual-keys/:id/reset-spend',
    async (request, reply) => {
      const { id } = request.params;
      const service = getVirtualKeyService();
      await service.resetSpend(id);
      const key = await service.persistence.getKeyById(id);
      if (!key) {
        return reply.status(404).send({ error: 'Virtual key not found' });
      }
      logger.info({ keyId: id }, 'Virtual key spend reset');
      return { key };
    }
  );
}
