import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { adminStore } from '../admin-store.js';
import { ProviderSchema } from '../services/provider-registry.js';
import { saveProvidersToEnv, deleteProviderFromEnv } from '../utils/env-file.js';

const ProviderUpdateSchema = ProviderSchema.partial();

export async function providersRouter(fastify: FastifyInstance): Promise<void> {
  fastify.get('/', async (_request, _reply) => {
    const providers = adminStore.getProviders();
    const healthMap = new Map(adminStore.getProviderHealth().map((h) => [h.id, h]));

    const result = providers.map((p) => {
      const health = healthMap.get(p.id);
      return {
        ...p,
        apiKey: p.apiKey ? '***' + p.apiKey.slice(-4) : '',
        status: health?.status ?? 'unknown',
        latencyMs: health?.latencyMs ?? null,
        lastCheck: health?.lastCheck ?? null,
        successCount: health?.successCount ?? 0,
        errorCount: health?.errorCount ?? 0,
        totalCount: health?.totalCount ?? 0,
      };
    });

    return { providers: result };
  });

  fastify.post('/', async (request, reply) => {
    const result = ProviderSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: result.error.errors,
      });
    }

    const existing = adminStore.getProviderById(result.data.id);
    if (existing) {
      return reply.status(400).send({
        error: 'Provider with this ID already exists',
      });
    }

    const provider = adminStore.addProvider(result.data);
    try {
      saveProvidersToEnv(adminStore.getProviders());
    } catch (e) {
      console.error('Failed to save providers to .env:', e);
    }
    return {
      success: true,
      provider: {
        ...provider,
        apiKey: provider.apiKey ? '***' + provider.apiKey.slice(-4) : '',
      },
    };
  });

  fastify.put<{ Params: { id: string }; Body: z.infer<typeof ProviderUpdateSchema> }>(
    '/:id',
    async (request, reply) => {
      const { id } = request.params;

      const result = ProviderUpdateSchema.safeParse(request.body);
      if (!result.success) {
        return reply.status(400).send({
          error: 'Invalid request body',
          details: result.error.errors,
        });
      }

      const existing = adminStore.getProviderById(id);
      if (!existing) {
        return reply.status(404).send({
          error: 'Provider not found',
        });
      }

      const updated = adminStore.updateProvider(id, result.data);
      if (!updated) {
        return reply.status(500).send({
          error: 'Failed to update provider',
        });
      }

      saveProvidersToEnv(adminStore.getProviders());
      return {
        success: true,
        provider: {
          ...updated,
          apiKey: updated.apiKey ? '***' + updated.apiKey.slice(-4) : '',
        },
      };
    }
  );

  fastify.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const existing = adminStore.getProviderById(id);
    if (!existing) {
      return reply.status(404).send({
        error: 'Provider not found',
      });
    }

    const deleted = adminStore.deleteProvider(id);
    if (!deleted) {
      return reply.status(500).send({
        error: 'Failed to delete provider',
      });
    }

    deleteProviderFromEnv(id);
    saveProvidersToEnv(adminStore.getProviders());

    return {
      success: true,
      message: `Provider ${id} deleted`,
    };
  });

  fastify.post<{ Params: { id: string } }>('/:id/test', async (request, reply) => {
    const { id } = request.params;

    const provider = adminStore.getProviderById(id);
    if (!provider) {
      return reply.status(404).send({
        error: 'Provider not found',
      });
    }

    if (!provider.baseUrl) {
      return reply.status(400).send({
        success: false,
        error: 'Provider base URL not configured',
      });
    }

    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), provider.timeoutMs);

      const modelsUrl =
        provider.type === 'anthropic-compatible'
          ? provider.baseUrl.replace('/v1', '') + '/models'
          : `${provider.baseUrl}/models`;

      const response = await fetch(modelsUrl, {
        method: 'GET',
        headers: provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {},
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - startTime;

      if (response.ok) {
        adminStore.updateProviderHealth(id, {
          status: 'healthy',
          latencyMs,
          lastCheck: new Date().toISOString(),
        });

        return {
          success: true,
          latencyMs,
          status: 'healthy',
        };
      } else {
        adminStore.updateProviderHealth(id, {
          status: 'unhealthy',
          latencyMs,
          lastCheck: new Date().toISOString(),
        });

        return reply.status(400).send({
          success: false,
          latencyMs,
          status: 'unhealthy',
          error: `HTTP ${response.status}: ${response.statusText}`,
        });
      }
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      adminStore.updateProviderHealth(id, {
        status: 'unhealthy',
        latencyMs,
        lastCheck: new Date().toISOString(),
      });

      return reply.status(500).send({
        success: false,
        latencyMs,
        status: 'unhealthy',
        error: errorMessage,
      });
    }
  });
}
