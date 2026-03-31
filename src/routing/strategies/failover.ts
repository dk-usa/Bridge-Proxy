import type { Deployment, RoutingContext, IRoutingStrategy } from '../types.js';

/**
 * FailoverStrategy - Selects deployment with lowest order number (highest priority).
 * Per RESEARCH.md §Pattern 3: Priority-based failover, skips unhealthy/cooldown deployments.
 */
export class FailoverStrategy implements IRoutingStrategy {
  name = 'failover' as const;

  select(deployments: Deployment[], _context: RoutingContext): Deployment | null {
    if (deployments.length === 0) return null;

    // Sort by order field ascending, return deployment with lowest order (highest priority)
    // Using spread to avoid mutating original array
    const sorted = [...deployments].sort((a, b) => a.order - b.order);

    return sorted[0] ?? null;
  }
}
