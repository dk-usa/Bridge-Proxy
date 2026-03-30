/**
 * Routing types and interfaces for deployment selection strategies.
 * Per D-09, D-10, D-11, D-12 from 05-CONTEXT.md.
 */

/**
 * Available routing strategies.
 * Per D-09: Default strategy is 'simple-shuffle' (weighted random).
 * Per D-10: All 5 strategies implemented.
 */
export type RoutingStrategy =
  | 'simple-shuffle'
  | 'least-busy'
  | 'latency-based'
  | 'cost-based'
  | 'failover';

/**
 * Deployment represents a specific model deployment on a provider.
 * Used by routing strategies to select the best deployment for a request.
 */
export interface Deployment {
  /** Unique identifier for this deployment */
  id: string;
  /** Logical model name (user-facing alias) */
  modelName: string;
  /** Provider identifier */
  providerId: string;
  /** Provider-specific model string */
  providerModel: string;
  /** Requests per minute limit (null = unlimited) */
  rpm: number | null;
  /** Tokens per minute limit (null = unlimited) */
  tpm: number | null;
  /** Weight for weighted selection (used by simple-shuffle) */
  weight: number;
  /** Priority order for failover (lower = higher priority) */
  order: number;
  /** Cooldown expiry timestamp (null = not in cooldown) */
  cooldownUntil: Date | null;
  /** Average latency in milliseconds (null = no data) */
  avgLatencyMs: number | null;
  /** Input cost per million tokens (null = unknown) */
  inputCostPerMillion: number | null;
}

/**
 * Routing context passed to strategy selection methods.
 * Contains request-specific information for routing decisions.
 */
export interface RoutingContext {
  /** Model being requested */
  model: string;
  /** Estimated token count for the request */
  estimatedTokens: number;
  /** Configured routing strategy */
  strategy: RoutingStrategy;
  /** Current retry depth (0 = first attempt) */
  retryDepth: number;
  /** Maximum retries allowed */
  maxRetries: number;
}

/**
 * Strategy interface for routing implementations.
 * Each strategy selects the best deployment from available options.
 */
export interface IRoutingStrategy {
  /** Strategy name (matches RoutingStrategy type) */
  name: string;
  /**
   * Select the best deployment from available options.
   * @param deployments - Filtered healthy deployments
   * @param context - Routing context with request details
   * @returns Selected deployment or null if none available
   */
  select(deployments: Deployment[], context: RoutingContext): Deployment | null;
}

/**
 * Cooldown configuration.
 * Per D-11: Configurable cooldown with allowed_fails and cooldown_time.
 */
export interface CooldownConfig {
  /** Number of consecutive failures before cooldown (default 3) */
  allowedFails: number;
  /** Cooldown duration in seconds (default 30) */
  cooldownTimeSeconds: number;
}

/**
 * Default cooldown configuration.
 */
export const DEFAULT_COOLDOWN_CONFIG: CooldownConfig = {
  allowedFails: 3,
  cooldownTimeSeconds: 30,
};

/**
 * Default retry configuration.
 * Per D-12: Per-request retry limit tracked in routing context.
 */
export const DEFAULT_MAX_RETRIES = 2;
