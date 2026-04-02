# Phase 4: Smart Caching & Semantic Similarity - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Reduce provider API costs by finding semantically equivalent responses. When a request arrives, check if similar requests have cached responses before calling the provider. Requirements: CACHE-01, CACHE-02, CACHE-03, CACHE-04.

</domain>

<decisions>
## Implementation Decisions

### Embedding Generation Approach

- **D-01:** Reuse existing `/v1/embeddings` endpoint for generating embeddings
- **D-02:** Embed `messages` array + `system` prompt for similarity comparison
- **D-03:** Use configured model mappings for embedding model selection

### Similarity Matching Strategy

- **D-04:** Cosine similarity with Redis-backed embedding storage
- **D-05:** Similarity threshold: 0.15 (configurable via `SEMANTIC_CACHE_THRESHOLD` env var)
- **D-06:** Default threshold per CACHE-02 requirement

### Fallback Behavior

- **D-07:** When embedding service unavailable, fall back to exact cache match only (per CACHE-04)
- **D-08:** Log warning when semantic cache degraded, continue serving requests

### Cache Integration Layer

- **D-09:** Semantic cache check occurs AFTER exact cache miss, BEFORE provider call
- **D-10:** Semantic caching disabled by default — enable via `SEMANTIC_CACHE_ENABLED=true`
- **D-11:** Graceful degradation when Redis unavailable

### Metrics and Observability

- **D-12:** Track semantic cache hits/misses separately from exact cache (per CACHE-03)
- **D-13:** Track similarity scores on hits for threshold tuning
- **D-14:** Track cost savings estimate from semantic hits
- **D-15:** Track embedding generation latency

### Agent's Discretion

- Exact implementation of cosine similarity calculation
- Embedding cache key format and storage structure
- Metric naming conventions
- Admin dashboard display for semantic cache stats

</decisions>

<canonical_refs>

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements

- `.planning/REQUIREMENTS.md` §Smart Caching — CACHE-01 through CACHE-04 requirements

### Existing Code

- `src/services/cache.ts` — Current CacheService with exact matching, tenant isolation
- `src/routes/embeddings.ts` — Existing embeddings endpoint to reuse
- `src/core/pipeline.ts` — Request processing pipeline (integration point)
- `src/providers/base.ts` — Provider interface with `createEmbedding()` method

### Architecture

- `.planning/codebase/ARCHITECTURE.md` — Cache layer architecture, Redis integration
- `.planning/codebase/INTEGRATIONS.md` — Redis configuration, cache patterns

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `CacheService` in `src/services/cache.ts` — Extend with semantic matching methods
- `/v1/embeddings` endpoint — Already generates embeddings, has caching
- Redis client (`ioredis`) — Already configured for caching/rate limiting
- `providerRegistry.createEmbedding()` — All providers support embeddings

### Established Patterns

- Cache entries stored with `CacheEntry<T>` interface
- Tenant isolation via `tenantId` in cache keys and entries
- Graceful degradation when Redis unavailable
- Config loaded from environment variables

### Integration Points

- `src/core/pipeline.ts` — `processRequest()` needs semantic cache check after exact cache miss
- `src/routes/messages.ts` — Non-streaming endpoint, primary integration point
- `src/routes/chat-completions.ts` — Streaming support consideration
- `adminStore` — Metrics tracking and stats retrieval

</code_context>

<specifics>
## Specific Ideas

- Semantic cache provides significant cost savings when users ask similar questions
- Similarity threshold tuning important for balancing cost savings vs response relevance
- Must maintain tenant isolation for semantic cache entries

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 04-smart-caching-semantic-similarity_
_Context gathered: 2026-03-25_
