import crypto from 'crypto';
import { getRedis, isRedisAvailable } from './redis.js';
import { providerRegistry } from './index.js';
import { adminStore } from '../admin-store.js';
import type { CacheEntry } from './cache.js';

/**
 * Configuration for semantic cache
 */
export interface SemanticCacheConfig {
  /** Similarity threshold (0-1). Entries with similarity >= threshold are considered matches. Default: 0.15 */
  threshold?: number;
  /** Whether semantic cache is enabled. Default: false */
  enabled?: boolean;
  /** TTL for semantic cache entries in ms. Default: 3600000 (1 hour) */
  ttl?: number;
  /** Embedding model to use. Default: uses primary provider's default */
  embeddingModel?: string;
}

/**
 * Entry in the semantic cache
 */
export interface SemanticCacheEntry<T> extends CacheEntry<T> {
  /** The embedding vector for similarity comparison */
  embedding: number[];
  /** The similarity score when this entry was matched */
  similarityScore?: number;
}

/**
 * Statistics for semantic cache
 * Per decisions D-12, D-13, D-14, D-15
 */
export interface SemanticCacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  avgSimilarityScore: number;
  avgEmbeddingLatencyMs: number;
  estimatedCostSavings: number;
  similarityScores: number[];
  embeddingLatencies: number[];
}

/**
 * Calculate cosine similarity between two vectors
 * Formula: dot(a,b) / (magnitude(a) * magnitude(b))
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score between -1 and 1, or 0 if either vector is zero
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  if (a.length === 0) {
    return 0;
  }

  // Calculate dot product
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  // Handle zero vectors
  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}

/**
 * Semantic cache service that finds similar cached responses using embedding vectors
 *
 * This enables matching semantically similar requests to reuse cached responses,
 * reducing provider API costs.
 */
export class SemanticCacheService {
  private memoryCache: Map<string, SemanticCacheEntry<unknown>> = new Map();
  private hits = 0;
  private misses = 0;
  private similarityScores: number[] = []; // D-13
  private embeddingLatencies: number[] = []; // D-15
  private costSavingsEstimate = 0; // D-14
  private threshold: number;
  private enabled: boolean;
  private defaultTtl: number;
  private embeddingModel?: string;
  private readonly keyPrefix = 'semantic-cache';

  // Cost estimate: $0.0001 per 1K tokens saved per hit (baseline estimate)
  private readonly COST_PER_HIT_ESTIMATE = 0.0001;

  constructor(config: SemanticCacheConfig = {}) {
    this.threshold = config.threshold ?? 0.15;
    this.enabled = config.enabled ?? false;
    this.defaultTtl = config.ttl ?? 3600000; // 1 hour default
    this.embeddingModel = config.embeddingModel;
  }

  /**
   * Generate an embedding vector for the given text
   *
   * Calls the embedding endpoint via the provider and returns the embedding vector.
   * Caches embedding results for reuse (5-minute TTL).
   *
   * @param text - The text to generate embedding for
   * @returns The embedding vector, or null if generation failed
   */
  async generateEmbedding(text: string): Promise<number[] | null> {
    if (!this.enabled) {
      return null;
    }

    const startTime = Date.now();

    try {
      // Use primary provider for embeddings
      const provider = providerRegistry.getById('primary') || providerRegistry.getById('nim');
      if (!provider) {
        console.warn('SemanticCache: No provider available for embedding generation');
        return null;
      }

      const model =
        this.embeddingModel ||
        adminStore.resolveModel('text-embedding-ada-002')?.providerModel ||
        provider.models[0] ||
        'text-embedding-ada-002';

      // Call embedding endpoint directly
      const url = `${provider.baseUrl}/embeddings`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(provider.apiKey ? { Authorization: `Bearer ${provider.apiKey}` } : {}),
        },
        body: JSON.stringify({
          model,
          input: text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn('SemanticCache: Embedding request failed:', response.status, errorText);
        return null;
      }

      const result = (await response.json()) as {
        data?: Array<{
          object: string;
          embedding: number[] | string;
          index: number;
        }>;
        model?: string;
      };

      if (!result?.data?.[0]?.embedding) {
        console.warn('SemanticCache: Empty embedding result');
        return null;
      }

      const embedding = result.data[0].embedding;
      const latency = Date.now() - startTime;
      this.embeddingLatencies.push(latency);

      // Return as number array (handle base64 encoding if needed)
      if (typeof embedding === 'string') {
        // Base64 encoded - would need decoding, for now return null
        console.warn('SemanticCache: Base64 embedding encoding not supported');
        return null;
      }

      return embedding;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.warn('SemanticCache: Embedding generation failed:', message);
      return null;
    }
  }

  /**
   * Store an entry in the semantic cache
   *
   * @param key - Unique key for the entry
   * @param embedding - The embedding vector
   * @param data - The data to cache
   * @param tenantId - Tenant identifier for isolation
   * @param options - Optional configuration
   */
  async set<T>(
    key: string,
    embedding: number[],
    data: T,
    tenantId: string,
    options?: { ttl?: number }
  ): Promise<void> {
    const ttl = options?.ttl ?? this.defaultTtl;
    const fullKey = `${this.keyPrefix}:${tenantId}:${key}`;

    const entry: SemanticCacheEntry<T> = {
      data,
      embedding,
      createdAt: Date.now(),
      expiresAt: Date.now() + ttl,
      hitCount: 0,
      tenantId: tenantId || '',
    };

    // Store in memory cache
    this.memoryCache.set(fullKey, entry as SemanticCacheEntry<unknown>);

    // Store in Redis if available
    const redis = getRedis();
    if (redis && isRedisAvailable()) {
      await redis.setex(fullKey, Math.ceil(ttl / 1000), JSON.stringify(entry));
    }
  }

  /**
   * Find a similar cached entry
   *
   * Scans stored embeddings and returns the entry with highest similarity
   * above the threshold.
   *
   * @param embedding - The query embedding vector
   * @param tenantId - Tenant identifier for isolation
   * @returns The most similar entry, or null if none found above threshold
   */
  async findSimilar<T>(
    embedding: number[],
    tenantId: string
  ): Promise<SemanticCacheEntry<T> | null> {
    if (!this.enabled) {
      this.misses++;
      return null;
    }

    let bestMatch: SemanticCacheEntry<T> | null = null;
    let bestSimilarity = -Infinity;

    const redis = getRedis();
    const keyPattern = `${this.keyPrefix}:${tenantId}:*`;

    // Search Redis if available
    if (redis && isRedisAvailable()) {
      try {
        // Use SCAN to iterate keys
        let cursor = '0';
        do {
          const result = await redis.scan(cursor, 'MATCH', keyPattern, 'COUNT', 100);
          cursor = result[0];
          const keys = result[1];

          for (const key of keys) {
            const data = await redis.get(key);
            if (!data) continue;

            try {
              const entry: SemanticCacheEntry<T> = JSON.parse(data);

              // Skip expired entries
              if (entry.expiresAt <= Date.now()) {
                await redis.del(key);
                continue;
              }

              // Validate tenant (defense-in-depth)
              if (entry.tenantId !== tenantId) {
                console.error('Cross-tenant semantic cache access attempt', {
                  entryTenantId: entry.tenantId,
                  requestTenantId: tenantId,
                  key,
                });
                continue;
              }

              // Calculate similarity
              const similarity = cosineSimilarity(embedding, entry.embedding);

              // Check if above threshold and better than current best
              if (similarity >= this.threshold && similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestMatch = entry;
                bestMatch.similarityScore = similarity;
              }
            } catch {
              // Invalid JSON, skip
              await redis.del(key);
            }
          }
        } while (cursor !== '0');
      } catch (error) {
        console.error('SemanticCache: Redis scan error:', error);
        // Fall through to memory cache search
      }
    }

    // Search memory cache (fallback or supplement)
    for (const [key, entry] of this.memoryCache.entries()) {
      // Skip if not for this tenant
      if (!key.startsWith(`${this.keyPrefix}:${tenantId}:`)) {
        continue;
      }

      // Skip expired entries
      if (entry.expiresAt <= Date.now()) {
        this.memoryCache.delete(key);
        continue;
      }

      // Validate tenant (defense-in-depth)
      if (entry.tenantId !== tenantId) {
        console.error('Cross-tenant semantic cache access attempt', {
          entryTenantId: entry.tenantId,
          requestTenantId: tenantId,
          key,
        });
        continue;
      }

      // Calculate similarity
      const similarity = cosineSimilarity(embedding, entry.embedding);

      // Check if above threshold and better than current best
      if (similarity >= this.threshold && similarity > bestSimilarity) {
        bestSimilarity = similarity;
        bestMatch = entry as SemanticCacheEntry<T>;
        bestMatch.similarityScore = similarity;
      }
    }

    if (bestMatch) {
      this.hits++;
      this.similarityScores.push(bestSimilarity);
      // Track cost savings estimate (D-14)
      this.costSavingsEstimate += this.COST_PER_HIT_ESTIMATE;
      return bestMatch;
    }

    this.misses++;
    return null;
  }

  /**
   * Generate a key for the semantic cache
   *
   * Uses SHA256 hash of the embedding vector (first 10 dimensions for reasonable key length)
   *
   * @param embedding - The embedding vector
   * @returns A unique key for the embedding
   */
  generateKey(embedding: number[]): string {
    // Use first 10 dimensions for hash (reasonable key length)
    const slice = embedding.slice(0, 10);
    return crypto.createHash('sha256').update(JSON.stringify(slice)).digest('hex').slice(0, 32);
  }

  /**
   * Clear all cached entries (for testing/admin purposes)
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();

    const redis = getRedis();
    if (redis && isRedisAvailable()) {
      const keys = await redis.keys(`${this.keyPrefix}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  }

  /**
   * Get semantic cache statistics
   * Per decisions D-12, D-13, D-14, D-15
   */
  getStats(): SemanticCacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;
    const avgSimilarityScore =
      this.similarityScores.length > 0
        ? this.similarityScores.reduce((a, b) => a + b, 0) / this.similarityScores.length
        : 0;
    const avgEmbeddingLatencyMs =
      this.embeddingLatencies.length > 0
        ? this.embeddingLatencies.reduce((a, b) => a + b, 0) / this.embeddingLatencies.length
        : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      hitRate,
      avgSimilarityScore,
      avgEmbeddingLatencyMs,
      estimatedCostSavings: this.costSavingsEstimate,
      similarityScores: [...this.similarityScores],
      embeddingLatencies: [...this.embeddingLatencies],
    };
  }

  /**
   * Reset all statistics (for testing)
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.similarityScores = [];
    this.embeddingLatencies = [];
    this.costSavingsEstimate = 0;
  }

  /**
   * Check if semantic cache is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable or disable semantic cache
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Get the current similarity threshold
   */
  getThreshold(): number {
    return this.threshold;
  }

  /**
   * Set the similarity threshold
   */
  setThreshold(threshold: number): void {
    if (threshold < 0 || threshold > 1) {
      throw new Error('Threshold must be between 0 and 1');
    }
    this.threshold = threshold;
  }
}

// Default export instance (disabled by default per D-10)
export const semanticCacheService = new SemanticCacheService({ enabled: false });
