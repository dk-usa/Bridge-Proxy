import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { observabilityService } from '../services/observability.js';
import { getVirtualKeyService } from '../virtual-keys/service.js';
import { getLogger } from '../config/index.js';

const DateRangeQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export async function observabilityRoutes(fastify: FastifyInstance): Promise<void> {
  const logger = getLogger();

  fastify.get('/costs/by-key', async (request, reply) => {
    const result = DateRangeQuerySchema.safeParse(request.query);
    if (!result.success) {
      return reply
        .status(400)
        .send({ error: 'Invalid query parameters', details: result.error.errors });
    }

    try {
      const virtualKeyService = getVirtualKeyService();
      const keys = await virtualKeyService.listKeys();

      const costsByKey = await Promise.all(
        keys.map(async (key) => {
          const cost = await observabilityService.getCostByKey(key.id);
          return {
            keyId: key.id,
            keyName: key.name,
            totalCost: cost,
          };
        })
      );

      return { costs: costsByKey };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to get costs by key');
      return reply.status(500).send({ error: 'Failed to get costs by key' });
    }
  });

  fastify.get('/costs/by-model', async (_request, reply) => {
    try {
      const costsByModel = await observabilityService.getAllCostsByModel();
      const result = Array.from(costsByModel.entries()).map(([model, cost]) => ({
        model,
        totalCost: cost,
      }));
      return { costs: result };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to get costs by model');
      return reply.status(500).send({ error: 'Failed to get costs by model' });
    }
  });

  fastify.get('/fallbacks', async (_request, reply) => {
    try {
      const frequency = await observabilityService.getAllFallbackFrequency();
      const fallbacks = Array.from(frequency.entries()).map(([from, count]) => ({
        fromProvider: from,
        count,
      }));
      return { fallbacks };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to get fallback frequency');
      return reply.status(500).send({ error: 'Failed to get fallback frequency' });
    }
  });

  fastify.get<{
    Params: { providerId: string; model: string };
  }>('/latency/:providerId/:model', async (request, reply) => {
    const { providerId, model } = request.params;

    try {
      const stats = await observabilityService.getLatencyStats(providerId, model);
      return {
        providerId,
        model,
        p50: stats.p50,
        p95: stats.p95,
        p99: stats.p99,
        count: stats.count,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to get latency stats');
      return reply.status(500).send({ error: 'Failed to get latency stats' });
    }
  });

  fastify.get('/summary', async (_request, reply) => {
    try {
      const [costsByKey, costsByModel, fallbacks] = await Promise.all([
        observabilityService.getAllCostsByKey(),
        observabilityService.getAllCostsByModel(),
        observabilityService.getAllFallbackFrequency(),
      ]);

      const totalCost = Array.from(costsByKey.values()).reduce((sum, c) => sum + c, 0);
      const totalFallbacks = Array.from(fallbacks.values()).reduce((sum, c) => sum + c, 0);

      return {
        totalCost,
        totalFallbacks,
        keysTracked: costsByKey.size,
        modelsTracked: costsByModel.size,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to get observability summary');
      return reply.status(500).send({ error: 'Failed to get observability summary' });
    }
  });
}
