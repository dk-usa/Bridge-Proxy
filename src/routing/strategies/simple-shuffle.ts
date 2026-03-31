import type { Deployment, RoutingContext, IRoutingStrategy } from '../types.js';

/**
 * SimpleShuffleStrategy - Weighted random selection (default strategy).
 * Per D-09: Default strategy for production use.
 * Per RESEARCH.md §Pattern 3: Weighted random based on deployment weight field.
 */
export class SimpleShuffleStrategy implements IRoutingStrategy {
  name = 'simple-shuffle' as const;

  select(deployments: Deployment[], _context: RoutingContext): Deployment | null {
    if (deployments.length === 0) return null;

    // Calculate total weight from all deployments
    const totalWeight = deployments.reduce((sum, d) => sum + d.weight, 0);

    // If all weights are zero, return first deployment
    if (totalWeight === 0) {
      return deployments.find((d) => d.weight > 0) ?? deployments[0] ?? null;
    }

    // Generate random number in [0, totalWeight)
    let random = Math.random() * totalWeight;

    // Iterate and subtract weights, return first where random <= 0
    for (const deployment of deployments) {
      random -= deployment.weight;
      if (random <= 0) return deployment;
    }

    // Fallback to last deployment
    return deployments[deployments.length - 1] ?? null;
  }
}
