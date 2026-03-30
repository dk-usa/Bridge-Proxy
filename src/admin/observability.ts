import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getObservabilityService } from '../services/observability.js';
import { getVirtualKeyService } from '../virtual-keys/service.js';
import { getLogger } from '../config/index.js';

// Query schema for date range
const DateRangeQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/**
 * Admin API routes for observability.
 *
 * Per plan 05-06: Cost per key/model, fallback frequency, latency histograms.
 */
export async function observabilityRoutes(fastify: FastifyInstance): Promise<void> {
  const logger = getLogger();
  const observabilityService = getObservabilityService();

  // GET /admin/observability/costs/by-key - cost per virtual key
  fastify.get('/observability/costs/by-key', async (request, reply) => {
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
            // Use spend as proxy for request activity (no requestCount field)
            requestCount: 0,
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

  // GET /admin/observability/costs/by-model - cost per model
  fastify.get('/observability/costs/by-model', async (request, reply) => {
    const result = DateRangeQuerySchema.safeParse(request.query);
    if (!result.success) {
      return reply
        .status(400)
        .send({ error: 'Invalid query parameters', details: result.error.errors });
    }

    try {
      // Get all latency keys to extract model names
      const latencyKeys = await observabilityService['redis'].keys('obs:latency:*');
      const models = new Set<string>();

      for (const key of latencyKeys) {
        // Extract model from obs:latency:{provider}:{model}
        const parts = key.split(':');
        if (parts.length >= 4) {
          models.add(parts.slice(3).join(':'));
        }
      }

      // Also check cost keys
      const costKeys = await observabilityService['redis'].keys('obs:cost:model:*');
      for (const key of costKeys) {
        const model = key.replace('obs:cost:model:', '');
        models.add(model);
      }

      const costsByModel = await Promise.all(
        Array.from(models).map(async (model) => {
          const cost = await observabilityService.getCostByModel(model);
          return {
            model,
            totalCost: cost,
            requestCount: 0, // We don't track request count per model in this implementation
          };
        })
      );

      return { costs: costsByModel };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to get costs by model');
      return reply.status(500).send({ error: 'Failed to get costs by model' });
    }
  });

  // GET /admin/observability/fallbacks - fallback frequency
  fastify.get('/observability/fallbacks', async (_request, reply) => {
    try {
      const frequency = await observabilityService.getFallbackFrequency();

      const fallbacks = Object.entries(frequency).map(([key, count]) => {
        const [from, to] = key.split(':');
        return { from, to, count };
      });

      return { fallbacks };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to get fallback frequency');
      return reply.status(500).send({ error: 'Failed to get fallback frequency' });
    }
  });

  // GET /admin/observability/latency/:providerId/:model - latency stats
  fastify.get<{
    Params: { providerId: string; model: string };
  }>('/observability/latency/:providerId/:model', async (request, reply) => {
    const { providerId, model } = request.params;

    try {
      const [percentiles, histogram] = await Promise.all([
        observabilityService.getLatencyPercentiles(providerId, model),
        observabilityService.getLatencyHistogram(providerId, model),
      ]);

      return {
        providerId,
        model,
        p50: percentiles.p50,
        p95: percentiles.p95,
        p99: percentiles.p99,
        histogram,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to get latency stats');
      return reply.status(500).send({ error: 'Failed to get latency stats' });
    }
  });

  // GET /admin/observability/summary - combined dashboard data
  fastify.get('/observability/summary', async (_request, reply) => {
    try {
      const virtualKeyService = getVirtualKeyService();
      const keys = await virtualKeyService.listKeys();

      // Calculate total cost and requests
      let totalCost = 0;
      let totalRequests = 0;

      for (const key of keys) {
        const cost = await observabilityService.getCostByKey(key.id);
        totalCost += cost;
        // No requestCount field on VirtualKey - using 0 as placeholder
      }

      // Get fallback frequency
      const fallbackFrequency = await observabilityService.getFallbackFrequency();
      const totalFallbacks = Object.values(fallbackFrequency).reduce((sum, c) => sum + c, 0);

      // Get top models by cost
      const latencyKeys = await observabilityService['redis'].keys('obs:cost:model:*');
      const modelCosts: { model: string; cost: number }[] = [];

      for (const key of latencyKeys) {
        const model = key.replace('obs:cost:model:', '');
        const cost = await observabilityService.getCostByModel(model);
        if (cost > 0) {
          modelCosts.push({ model, cost });
        }
      }

      modelCosts.sort((a, b) => b.cost - a.cost);
      const topModels = modelCosts.slice(0, 5);

      // Calculate fallback rate
      const fallbackRate = totalRequests > 0 ? totalFallbacks / totalRequests : 0;

      // Get average latency across all providers/models (simplified)
      let avgLatency = 0;
      const allLatencyKeys = await observabilityService['redis'].keys('obs:latency:*');
      if (allLatencyKeys.length > 0) {
        let totalP50 = 0;
        let count = 0;
        for (const key of allLatencyKeys) {
          const parts = key.split(':');
          if (parts.length >= 4) {
            const providerId = parts[2];
            const model = parts.slice(3).join(':');
            const percentiles = await observabilityService.getLatencyPercentiles(providerId, model);
            if (percentiles.p50 > 0) {
              totalP50 += percentiles.p50;
              count++;
            }
          }
        }
        avgLatency = count > 0 ? totalP50 / count : 0;
      }

      return {
        totalCost,
        totalRequests,
        avgLatency,
        topModels,
        fallbackRate,
        totalFallbacks,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error({ error: errorMessage }, 'Failed to get observability summary');
      return reply.status(500).send({ error: 'Failed to get observability summary' });
    }
  });
}
