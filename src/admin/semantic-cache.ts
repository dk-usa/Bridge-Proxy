import { FastifyInstance } from 'fastify';
import { semanticCacheService } from '../services/semantic-cache.js';
import { getConfig } from '../config/index.js';

/**
 * Admin router for semantic cache statistics
 * Per decision D-12
 */
export async function semanticCacheRouter(fastify: FastifyInstance): Promise<void> {
  fastify.get('/stats', async (_request, _reply) => {
    const stats = semanticCacheService.getStats();
    const config = getConfig();

    return {
      enabled: config.semanticCache?.enabled ?? false,
      threshold: config.semanticCache?.threshold ?? 0.15,
      hits: stats.hits,
      misses: stats.misses,
      hitRate: stats.hitRate,
      avgSimilarityScore: stats.avgSimilarityScore,
      avgEmbeddingLatencyMs: stats.avgEmbeddingLatencyMs,
      estimatedCostSavings: stats.estimatedCostSavings,
    };
  });
}
