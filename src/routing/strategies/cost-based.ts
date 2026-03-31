import type { Deployment, RoutingContext, IRoutingStrategy } from '../types.js';

/**
 * CostBasedStrategy - Selects deployment with lowest input cost per million tokens.
 * Per RESEARCH.md §Pattern 3: Sorts by inputCostPerMillion ascending,
 * returns deployment with lowest cost.
 */
export class CostBasedStrategy implements IRoutingStrategy {
  name = 'cost-based' as const;

  select(deployments: Deployment[], _context: RoutingContext): Deployment | null {
    if (deployments.length === 0) return null;

    // Sort by inputCostPerMillion ascending, treating null as Infinity
    const sorted = [...deployments].sort(
      (a, b) => (a.inputCostPerMillion ?? Infinity) - (b.inputCostPerMillion ?? Infinity)
    );

    return sorted[0] ?? null;
  }
}
