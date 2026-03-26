/**
 * Semantic cache middleware for pipeline integration.
 *
 * This module provides functions to check and store semantic cache entries
 * for the request processing pipeline.
 *
 * Per decisions:
 * - D-02: Embed messages array + system prompt
 * - D-07: Fallback on embedding failure
 * - D-09: Semantic cache check occurs AFTER exact cache miss
 * - D-10: Disabled by default
 */

import { getConfig } from '../config/index.js';
import { semanticCacheService } from './semantic-cache.js';
import type { AnthropicMessageRequest, AnthropicMessageResponse } from '../schemas/anthropic.js';

/**
 * Extract text from an Anthropic message request for embedding generation.
 *
 * Extracts text from:
 * - System prompt (string or blocks)
 * - Messages (string content or content blocks)
 *
 * @param request - The Anthropic message request
 * @returns Concatenated text from all sources
 */
export function extractRequestText(request: AnthropicMessageRequest): string {
  const parts: string[] = [];

  // Extract system prompt if present
  if (request.system) {
    if (typeof request.system === 'string') {
      parts.push(request.system);
    } else {
      // System is an array of content blocks
      parts.push(request.system.map((b: { type: 'text'; text: string }) => b.text).join(' '));
    }
  }

  // Extract text from messages
  for (const msg of request.messages) {
    const content = msg.content;
    if (typeof content === 'string') {
      parts.push(content);
    } else {
      // Content is an array of content blocks
      parts.push(content.map((b: { text?: string }) => b.text ?? '').join(' '));
    }
  }

  return parts.join('\n');
}

/**
 * Result of checking the semantic cache
 */
export interface SemanticCacheCheckResult {
  /** Whether a similar cached response was found */
  hit: boolean;
  /** The cached response (if hit) */
  response?: AnthropicMessageResponse;
  /** The generated embedding (for storage on miss) */
  embedding?: number[];
}

/**
 * Check the semantic cache for a similar request.
 *
 * This function should be called AFTER an exact cache miss.
 * It generates an embedding for the request text and searches
 * for similar cached entries.
 *
 * Per D-07: Falls back gracefully on embedding failure (returns { hit: false })
 * Per D-09: Only called after exact cache miss
 * Per D-10: Returns immediately if semantic cache disabled
 *
 * @param request - The Anthropic message request
 * @param tenantId - Tenant identifier for isolation
 * @returns Result indicating hit/miss and optionally embedding/response
 */
export async function checkSemanticCache(
  request: AnthropicMessageRequest,
  tenantId: string
): Promise<SemanticCacheCheckResult> {
  const config = getConfig();

  // D-10: Disabled by default
  if (!config.semanticCache?.enabled) {
    return { hit: false };
  }

  // D-02: Generate embedding from messages + system prompt
  const text = extractRequestText(request);
  const embedding = await semanticCacheService.generateEmbedding(text);

  // D-07: Fallback on embedding failure
  if (!embedding) {
    console.warn('Semantic cache: embedding generation failed');
    return { hit: false };
  }

  // Search for similar cached entries
  const entry = await semanticCacheService.findSimilar<AnthropicMessageResponse>(
    embedding,
    tenantId
  );

  if (entry) {
    return { hit: true, response: entry.data, embedding };
  }

  // Return embedding for storage after provider call
  return { hit: false, embedding };
}

/**
 * Store a response in the semantic cache.
 *
 * Called after a successful provider response to cache it for
 * future semantic similarity matching.
 *
 * @param request - The original request (for reference)
 * @param response - The response to cache
 * @param embedding - The embedding vector for the request
 * @param tenantId - Tenant identifier for isolation
 */
export async function storeSemanticResponse(
  _request: AnthropicMessageRequest,
  response: AnthropicMessageResponse,
  embedding: number[],
  tenantId: string
): Promise<void> {
  const config = getConfig();

  // Skip if disabled
  if (!config.semanticCache?.enabled) {
    return;
  }

  // Generate a key for this embedding and store
  const key = semanticCacheService.generateKey(embedding);
  await semanticCacheService.set(key, embedding, response, tenantId);
}
