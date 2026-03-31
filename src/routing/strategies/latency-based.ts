import type { Deployment, RoutingContext, IRoutingStrategy } from '../types.js';

/**
 * LatencyBasedStrategy - Selects deployment with lowest average latency.
 * Per RESEARCH.md §Pattern 3: Filters deployments with avgLatencyMs !== null,
 * sorts by avgLatencyMs ascending, returns deployment with lowest latency.
 */
export class LatencyBasedStrategy implements IRoutingStrategy {
  name = 'latency-based' as const;

  select(deployments: Deployment[], _context: RoutingContext): Deployment | null {
    if (deployments.length === 0) return null;

    // Filter to deployments with latency data
    const withLatency = deployments.filter((d) => d.avgLatencyMs !== null);

    // Return null if no deployments have latency data
    if (withLatency.length === 0) return null;

    // Sort by avgLatencyMs ascending, return lowest
    return (
      withLatency.sort((a, b) => (a.avgLatencyMs ?? Infinity) - (b.avgLatencyMs ?? Infinity))[0] ??
      null
    );
  }
}
