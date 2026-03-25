# Phase 4: Smart Caching & Semantic Similarity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 04-smart-caching-semantic-similarity
**Areas discussed:** Embeddings, Similarity matching, Cache integration, Metrics

---

## Embedding Generation Approach

| Option                                 | Description                                              | Selected |
| -------------------------------------- | -------------------------------------------------------- | -------- |
| Reuse existing /v1/embeddings endpoint | Leverage existing provider infrastructure, zero new code | ✓        |
| Dedicated embedding model in config    | SEMANTIC_CACHE_EMBEDDING_MODEL env var, more control     |          |
| External embedding service             | Call OpenAI directly, independent of provider config     |          |

**User's choice:** Reuse existing /v1/embeddings endpoint
**Notes:** Uses configured model mappings, already has caching, zero new code for embedding generation

---

## Embed Scope

| Option                        | Description                                                 | Selected |
| ----------------------------- | ----------------------------------------------------------- | -------- |
| Messages array only           | Simple, captures semantic meaning of user intent            |          |
| Messages + model + key params | More precise matching, fewer cache hits                     |          |
| Messages + system prompt      | Higher fidelity, matches when both prompt and query similar | ✓        |

**User's choice:** Messages + system prompt
**Notes:** Include system prompt in embedding for higher fidelity matching

---

## Similarity Matching Strategy

| Option                                      | Description                                           | Selected |
| ------------------------------------------- | ----------------------------------------------------- | -------- |
| Cosine similarity with Redis-backed storage | Works with existing Redis, simple, accurate           | ✓        |
| Approximate Nearest Neighbor (ANN)          | Better for large caches (>100K), overkill for gateway |          |
| In-memory similarity search                 | Fast for small caches, doesn't scale                  |          |

**User's choice:** Cosine similarity with Redis-backed storage

---

## Similarity Threshold

| Option                        | Description                               | Selected |
| ----------------------------- | ----------------------------------------- | -------- |
| 0.15 configurable via env var | Per CACHE-02, tunable per deployment      | ✓        |
| 0.30 (strict matching)        | Fewer cache hits, more relevant responses |          |

**User's choice:** 0.15 configurable via env var (SEMANTIC_CACHE_THRESHOLD)
**Notes:** Default 0.15 per REQUIREMENTS CACHE-02

---

## Fallback Behavior

| Option                                | Description                        | Selected |
| ------------------------------------- | ---------------------------------- | -------- |
| Fall back to exact cache match only   | Per CACHE-04, graceful degradation | ✓        |
| Log warning and proceed without cache | Simpler, loses exact cache benefit |          |

**User's choice:** Fall back to exact cache match only
**Notes:** Maintains availability when embedding service unavailable

---

## Cache Integration Layer

| Option                                       | Description                                           | Selected |
| -------------------------------------------- | ----------------------------------------------------- | -------- |
| After exact cache miss, before provider call | Minimal latency impact, best cost savings             | ✓        |
| Parallel with exact cache check              | Faster semantic hits but always incurs embedding cost |          |
| As async background warmup                   | Avoids first-request latency penalty                  |          |

**User's choice:** After exact cache miss, before provider call

---

## Enablement

| Option                                  | Description                            | Selected |
| --------------------------------------- | -------------------------------------- | -------- |
| Enabled by default when Redis available | Zero config for most deployments       |          |
| Disabled by default, explicit enable    | Opt-in via SEMANTIC_CACHE_ENABLED=true | ✓        |

**User's choice:** Disabled by default, explicit enable
**Notes:** Safer for production, requires explicit config change to activate

---

## Metrics and Observability

| Option                     | Description                                    | Selected |
| -------------------------- | ---------------------------------------------- | -------- |
| Semantic cache hits/misses | Per CACHE-03, enables cost savings measurement | ✓        |
| Similarity scores on hits  | Helps tune threshold, useful for debugging     | ✓        |
| Cost savings estimate      | Calculate $ saved, good for ROI                | ✓        |
| Embedding latency          | Track embedding generation time                | ✓        |

**User's choice:** All four metrics

---

_Audit trail: 2026-03-25_
