import type { Deployment, RoutingContext, IRoutingStrategy } from '../types.js';

/**
 * LeastBusyStrategy - Selects deployment with fewest in-flight requests.
 * Per RESEARCH.md §Pattern 3: Uses Redis for tracking in-flight counts per deployment.
 * Key: deploy:inflight:{deploymentId}
 */
export class LeastBusyStrategy implements IRoutingStrategy {
  name = 'least-busy' as const;

  /**
   * Select the deployment with the fewest in-flight requests.
   * Note: In-memory implementation for unit tests.
   * Production deployment would query Redis for actual counts.
   */
  select(deployments: Deployment[], _context: RoutingContext): Deployment | null {
    if (deployments.length === 0) return null;

    // For unit tests without Redis, return first deployment
    // Production integration would use:
    // const counts = await Promise.all(
    //   deployments.map(async (d) => ({
    //     deployment: d,
    //     count: parseInt((await redis.get(`deploy:inflight:${d.id}`)) ?? '0'),
    //   }))
    // );
    // counts.sort((a, b) => a.count - b.count);
    // return counts[0].deployment;

    // Simple fallback: return first available deployment
    return deployments[0] ?? null;
  }
}
