import type { Deployment, RoutingContext, RoutingStrategy, IRoutingStrategy } from './types.js';
import { CooldownManager } from './cooldown.js';
import { SimpleShuffleStrategy } from './strategies/simple-shuffle.js';
import { LeastBusyStrategy } from './strategies/least-busy.js';
import { LatencyBasedStrategy } from './strategies/latency-based.js';
import { CostBasedStrategy } from './strategies/cost-based.js';
import { FailoverStrategy } from './strategies/failover.js';

/**
 * RoutingService - Orchestrates deployment selection using strategies.
 * Per D-09, D-10: Supports all 5 routing strategies with strategy pattern.
 * Per D-11: Integrates with CooldownManager for failed deployment tracking.
 */
export class RoutingService {
  private readonly strategies: Map<string, IRoutingStrategy>;
  private readonly cooldownManager: CooldownManager;
  private readonly latencyTracker: Map<string, number>;

  constructor(cooldownManager: CooldownManager) {
    this.cooldownManager = cooldownManager;
    this.strategies = new Map();
    this.latencyTracker = new Map();

    // Register default strategy instances
    this.registerStrategy(new SimpleShuffleStrategy());
    this.registerStrategy(new LeastBusyStrategy());
    this.registerStrategy(new LatencyBasedStrategy());
    this.registerStrategy(new CostBasedStrategy());
    this.registerStrategy(new FailoverStrategy());
  }

  /**
   * Register a routing strategy.
   */
  registerStrategy(strategy: IRoutingStrategy): void {
    this.strategies.set(strategy.name, strategy);
  }

  /**
   * Get list of available strategy names.
   */
  getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }

  /**
   * Get the default strategy name.
   * Per D-09: simple-shuffle is the default.
   */
  getDefaultStrategy(): RoutingStrategy {
    return 'simple-shuffle';
  }

  /**
   * Select the best deployment for a request.
   * 1. Filter to enabled deployments
   * 2. Filter out cooldown deployments
   * 3. Apply strategy to filtered set
   *
   * @param context - Routing context with strategy selection
   * @param deployments - Available deployments
   * @returns Selected deployment or null if none available
   */
  async selectDeployment(
    context: RoutingContext,
    deployments: Deployment[]
  ): Promise<Deployment | null> {
    // Get healthy (non-cooldown) deployments
    const healthy = await this.getHealthyDeployments(context.model, deployments);

    if (healthy.length === 0) {
      return null;
    }

    // Apply strategy to filtered deployments
    const strategy = this.strategies.get(context.strategy);
    if (!strategy) {
      // Fallback to default strategy
      const defaultStrategy = this.strategies.get('simple-shuffle');
      return defaultStrategy?.select(healthy, context) ?? null;
    }

    return strategy.select(healthy, context);
  }

  /**
   * Get healthy deployments (enabled and not in cooldown).
   *
   * @param model - Model to filter by
   * @param deployments - All available deployments
   * @returns Filtered healthy deployments
   */
  async getHealthyDeployments(_model: string, deployments: Deployment[]): Promise<Deployment[]> {
    const healthy: Deployment[] = [];

    for (const deployment of deployments) {
      // Check if deployment is in cooldown via Redis
      const inCooldown = await this.cooldownManager.isInCooldown(deployment.id);
      if (!inCooldown) {
        healthy.push(deployment);
      }
    }

    return healthy;
  }

  /**
   * Record successful request - clears cooldown and updates latency.
   *
   * @param deploymentId - Deployment that handled the request
   * @param latencyMs - Request latency in milliseconds
   */
  async recordSuccess(deploymentId: string, latencyMs: number): Promise<void> {
    // Clear any failure tracking
    await this.cooldownManager.recordSuccess(deploymentId);

    // Track latency for latency-based routing
    this.updateDeploymentLatency(deploymentId, latencyMs);
  }

  /**
   * Record failed request - increments failure count, may trigger cooldown.
   *
   * @param deploymentId - Deployment that failed
   * @param errorType - Type of error (for logging/metrics)
   */
  async recordFailure(deploymentId: string, _errorType: string): Promise<void> {
    await this.cooldownManager.recordFailure(deploymentId);
  }

  /**
   * Update deployment latency tracking.
   * Used by latency-based strategy for selection.
   *
   * @param deploymentId - Deployment to update
   * @param latencyMs - Latency in milliseconds
   */
  updateDeploymentLatency(deploymentId: string, latencyMs: number): void {
    // Store the latency (could be extended to rolling average)
    this.latencyTracker.set(deploymentId, latencyMs);
  }

  /**
   * Get recorded latency for a deployment.
   *
   * @param deploymentId - Deployment to query
   * @returns Recorded latency or undefined
   */
  getDeploymentLatency(deploymentId: string): number | undefined {
    return this.latencyTracker.get(deploymentId);
  }
}

// Re-export types for convenience
export type { RoutingStrategy, Deployment, RoutingContext } from './types.js';
export { CooldownManager } from './cooldown.js';
export { RetryBudget } from './retry-budget.js';
