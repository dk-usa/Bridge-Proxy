# Phase 1: Security & Multi-Tenant Hardening - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Prevent cross-tenant data leakage through cache isolation. Users from one organization must never receive cached responses belonging to another organization. This phase focuses on securing the cache layer to ensure tenant isolation.

</domain>

<decisions>
## Implementation Decisions

### Cache Key Design

- **D-01:** Tenant ID is combination of `organizationId:teamId` for cache isolation
- **D-02:** Cache keys must be prefixed with tenant identifier before hashing
- **D-03:** New key format: `{prefix}:{orgId}:{teamId}:{requestHash}`

### Cache Entry Metadata

- **D-04:** Store `tenant_id` (orgId:teamId) in cache entry metadata for validation
- **D-05:** Cache entry structure extended to include `tenantId` field

### Cache Validation Strategy

- **D-06:** Defense-in-depth approach: both key-based isolation AND entry validation
- **D-07:** On cache retrieval, validate that entry's `tenantId` matches requesting tenant
- **D-08:** If tenant mismatch detected:
  - Do NOT return cached response
  - Log as ERROR (not warning)
  - Emit metric for monitoring
  - Fetch fresh response from provider
  - Only fail request if repeated/spike detected (potential attack pattern)

### Test Coverage

- **D-09:** Unit tests for cache service tenant validation logic
- **D-10:** Integration tests simulating cross-tenant request scenarios
- **D-11:** Collision tests for cache key collision scenarios

### Agent's Discretion

- Exact logging format and metric names
- Threshold for "repeated/spike" detection
- Implementation details of key generation method

</decisions>

<specifics>
## Specific Ideas

- "Correct behavior on mismatch: Do NOT use cached response, log as ERROR, emit metric, fetch fresh from provider, only fail if repeated/spike"
- Defense-in-depth security approach — both preventive (key isolation) and detective (validation)

</specifics>

<canonical_refs>

## Canonical References

### Security & Multi-Tenancy

- `.planning/codebase/CONCERNS.md` — Known security issues including cross-tenant cache leakage risk
- `.planning/research/PITFALLS.md` — Pitfall #2: Cross-tenant cache leakage, prevention strategies
- `.planning/research/SUMMARY.md` — Phase 1 recommendations for security hardening

### Existing Implementation

- `src/services/cache.ts` — Current cache service implementation (needs modification)
- `src/services/tenancy/index.ts` — Tenancy service with org/team/user hierarchy

</canonical_refs>

<code_context>

## Existing Code Insights

### Reusable Assets

- `CacheService` class in `src/services/cache.ts` — Core caching logic, needs tenant isolation extension
- `TenancyService.validateApiKey()` in `src/services/tenancy/index.ts` — Returns org/team/user context after API key validation
- `cacheService.generateKey()` — Existing key generation, needs tenant prefix

### Established Patterns

- Cache entries use `CacheEntry<T>` interface with `data`, `createdAt`, `expiresAt`, `hitCount`
- Cache options support `prefix` and `ttl` parameters
- Tenancy hierarchy: Organization → Team → User (API keys belong to org/team/user)

### Integration Points

- Routes (`src/routes/messages.ts`, `src/routes/chat-completions.ts`, `src/routes/embeddings.ts`) call cache service — need to pass tenant context
- Core pipeline (`src/core/pipeline.ts`) — orchestrates cache lookup
- API key validation returns tenant context — needs to flow to cache operations

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

_Phase: 01-security-multi-tenant-hardening_
_Context gathered: 2026-03-23_
