import { FastifyInstance } from 'fastify';
import { adminStore } from '../admin-store.js';
import { getConfig } from '../config/index.js';

export async function healthRouter(fastify: FastifyInstance): Promise<void> {
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
        adminTokenSet: !!getConfig().admin?.token,
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

  fastify.get('/health/usage', async (_request, _reply) => {
    const stats = adminStore.getStats();
    const logs = adminStore.getLogs({ limit: 1000 });

    const byModel: Record<
      string,
      {
        requests: number;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        cost: number;
      }
    > = {};
    const byProvider: Record<
      string,
      {
        requests: number;
        inputTokens: number;
        outputTokens: number;
        totalTokens: number;
        cost: number;
      }
    > = {};

    for (const log of logs.logs) {
      if (log.status === 'success') {
        const model = log.model ?? 'unknown';
        const provider = log.provider ?? 'unknown';

        if (!byModel[model]) {
          byModel[model] = {
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            cost: 0,
          };
        }
        byModel[model].requests++;
        byModel[model].inputTokens += log.inputTokens ?? 0;
        byModel[model].outputTokens += log.outputTokens ?? 0;
        byModel[model].totalTokens += log.totalTokens ?? 0;
        byModel[model].cost += log.totalCost ?? 0;

        if (!byProvider[provider]) {
          byProvider[provider] = {
            requests: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalTokens: 0,
            cost: 0,
          };
        }
        byProvider[provider].requests++;
        byProvider[provider].inputTokens += log.inputTokens ?? 0;
        byProvider[provider].outputTokens += log.outputTokens ?? 0;
        byProvider[provider].totalTokens += log.totalTokens ?? 0;
        byProvider[provider].cost += log.totalCost ?? 0;
      }
    }

    for (const model of Object.keys(byModel)) {
      byModel[model].cost = Math.round(byModel[model].cost * 100) / 100;
    }
    for (const provider of Object.keys(byProvider)) {
      byProvider[provider].cost = Math.round(byProvider[provider].cost * 100) / 100;
    }

    return {
      summary: {
        totalRequests: stats.totalRequests,
        successCount: stats.successCount,
        errorCount: stats.errorCount,
        totalInputTokens: stats.totalInputTokens,
        totalOutputTokens: stats.totalOutputTokens,
        totalTokens: stats.totalTokens,
        totalCost: stats.totalCost,
        avgLatencyMs: stats.avgLatency,
      },
      byModel,
      byProvider,
    };
  });
}
