import { FastifyInstance } from 'fastify';
import { adminAuthMiddleware } from './middleware.js';
import { providersRouter } from './providers.js';
import { modelsRouter } from './models.js';
import { logsRouter } from './logs.js';
import { tracesRouter } from './traces.js';
import { apiKeysRouter } from './api-keys.js';
import { orgsRouter } from './orgs.js';
import { teamsRouter } from './teams.js';
import { usersRouter } from './users.js';
import { semanticCacheRouter } from './semantic-cache.js';
import { virtualKeysRoutes } from './virtual-keys.js';
import { observabilityRoutes } from './observability.js';
import { adminStore } from '../admin-store.js';

export async function registerAdminRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook('onRequest', async (request, reply) => {
    await adminAuthMiddleware(request, reply);
    if (reply.sent) {
      return;
    }
  });

  fastify.get('/health', async (_request, _reply) => {
    const stats = adminStore.getStats();
    const providers = adminStore.getProviderHealth();

    const overallStatus =
      providers.length === 0
        ? 'unknown'
        : providers.every((p) => p.status === 'healthy')
          ? 'healthy'
          : providers.some((p) => p.status === 'unhealthy')
            ? 'unhealthy'
            : 'degraded';

    const dynamicProviders = adminStore.getProviders();

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      stats: {
        totalRequests: stats.totalRequests,
        successCount: stats.successCount,
        errorCount: stats.errorCount,
        avgLatencyMs: stats.avgLatency,
      },
      config: {
        adminTokenSet: false,
        providers: dynamicProviders.map((p) => ({
          id: p.id,
          type: p.type,
          baseUrl: p.baseUrl,
          enabled: p.enabled,
        })),
        modelMappingsCount: adminStore.getModelMappings().length,
      },
    };
  });

  fastify.get('/health/providers', async (_request, _reply) => {
    const providers = adminStore.getProviderHealth();
    return { providers };
  });

  fastify.get('/health/models', async (_request, _reply) => {
    const mappings = adminStore.getModelMappings();
    return {
      models: mappings.map((m) => ({
        anthropicModel: m.anthropicModel,
        providerId: m.providerId,
        providerModel: m.providerModel,
      })),
    };
  });

  await fastify.register(providersRouter, { prefix: '/providers' });
  await fastify.register(modelsRouter, { prefix: '/models' });
  await fastify.register(logsRouter, { prefix: '/logs' });
  await fastify.register(tracesRouter, { prefix: '/traces' });
  await fastify.register(apiKeysRouter);
  await fastify.register(orgsRouter, { prefix: '/orgs' });
  await fastify.register(teamsRouter, { prefix: '/teams' });
  await fastify.register(usersRouter, { prefix: '/users' });
  await fastify.register(semanticCacheRouter, { prefix: '/semantic-cache' });
  await fastify.register(virtualKeysRoutes, { prefix: '/virtual-keys' });
  await fastify.register(observabilityRoutes, { prefix: '/observability' });

  fastify.get('/stream/logs', async (request, reply) => {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const sendLog = () => {
      try {
        const logs = adminStore.getLogs({ limit: 10 });
        reply.raw.write(`data: ${JSON.stringify({ type: 'logs', logs: logs.logs })}\n\n`);
      } catch {
        // Ignore errors when sending
      }
    };

    sendLog();

    const interval = setInterval(() => {
      try {
        sendLog();
      } catch {
        clearInterval(interval);
      }
    }, 2000);

    request.raw.on('close', () => {
      clearInterval(interval);
    });
  });
}
