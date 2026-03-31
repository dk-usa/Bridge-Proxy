/**
 * RetryBudget - Per-request retry tracking.
 * Per D-12: Per-request retry limit (default 2), tracked in routing context.
 * Prevents infinite retry loops by limiting retry depth per request.
 */
export class RetryBudget {
  /** Current retry depth (number of retries attempted) */
  retryDepth: number;

  /** Maximum retries allowed */
  readonly maxRetries: number;

  constructor(maxRetries: number = 2) {
    this.retryDepth = 0;
    this.maxRetries = maxRetries;
  }

  /**
   * Check if another retry is allowed.
   * @returns true if retryDepth < maxRetries
   */
  canRetry(): boolean {
    return this.retryDepth < this.maxRetries;
  }

  /**
   * Increment retry depth after a failed attempt.
   */
  increment(): void {
    this.retryDepth++;
  }

  /**
   * Reset retry depth to zero (start of new request).
   */
  reset(): void {
    this.retryDepth = 0;
  }

  /**
   * Get remaining retries.
   */
  remaining(): number {
    return Math.max(0, this.maxRetries - this.retryDepth);
  }

  /**
   * Check if retry budget is exhausted.
   */
  exhausted(): boolean {
    return this.retryDepth >= this.maxRetries;
  }
}
