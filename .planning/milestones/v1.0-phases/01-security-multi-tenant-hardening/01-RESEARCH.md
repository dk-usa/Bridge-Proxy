# Phase 1: Security & Multi-Tenant Hardening - Research

**Phase:** 01-security-multi-tenant-hardening
**Researched:** 2026-03-23
**Status:** Complete

## Executive Summary

Phase 1 focuses on preventing cross-tenant data leakage through cache isolation. Research confirms this is a critical security issue that requires defense-in-depth: both key-based isolation (prevention) and entry validation (detection). The existing `CacheService` in `src/services/cache.ts` needs modification to include tenant context in cache keys and validate tenant ownership on retrieval.

## Current Implementation Analysis

### Cache Service (`src/services/cache.ts`)

**Current State:**

- Cache keys use format: `{prefix}:{requestHash}` (lines 33-34)
- No tenant identifier in keys
- `CacheEntry<T>` interface lacks tenant metadata (lines 4-9)
- Both Redis and in-memory cache share the same key format

**Gap:**

- Keys generated via `generateRequestKey()` (lines 143-146) include model + messages but no tenant
- Lookup via `get()` (lines 31-71) has no tenant validation
- `set()` (lines 73-91) stores without tenant context

### Tenancy Service (`src/services/tenancy/index.ts`)

**Available Context:**

- `validateApiKey()` returns `ApiKeyValidation` with organization, team, user (lines 243-326)
- API keys are associated with `organizationId` and `teamId`
- Tenant hierarchy: Organization → Team → User

**Integration Gap:**

- `processRequest()` in `src/core/pipeline.ts` does not pass tenant context to cache operations
- Routes (`src/routes/messages.ts`) call pipeline without tenant context
- API key validation happens but tenant info not propagated to cache

## Security Analysis

### Cross-Tenant Data Leakage Risk

**Attack Vector:**

1. User from Org A makes request → cache stores response
2. User from Org B makes similar request → same hash collision
3. User from Org B receives Org A's cached response

**Likelihood:** HIGH without tenant isolation

- Similar prompts across organizations (e.g., "Summarize this")
- Same model usage across tenants
- Hash collision on message content alone

**Impact:** CRITICAL

- PII exposure between organizations
- Business data leakage
- Compliance violations (GDPR, HIPAA)

## Recommended Implementation

### Cache Key Format (Per D-01, D-02, D-03)

```
{prefix}:{orgId}:{teamId}:{requestHash}
```

**Example:**

```
llm-cache:org_abc123:team_def456:a1b2c3d4e5f6...
```

### Cache Entry Structure (Per D-04, D-05)

```typescript
interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
  hitCount: number;
  tenantId: string; // NEW: format "{orgId}:{teamId}"
}
```

### Validation Logic (Per D-06, D-07, D-08)

```typescript
// On cache retrieval:
const entryTenantId = entry.tenantId;
const requestTenantId = `${orgId}:${teamId}`;

if (entryTenantId !== requestTenantId) {
  // Do NOT return cached response
  logger.error({ entryTenantId, requestTenantId }, 'Cross-tenant cache access attempt');
  metrics.increment('cache.tenant_mismatch');
  // Fetch fresh from provider
  return null;
}
```

## Testing Requirements (Per D-09, D-10, D-11)

### Unit Tests

1. **Key Generation Test**
   - Same request, different tenants → different keys
   - Different requests, same tenant → different keys
   - Same request, same tenant → same key

2. **Entry Validation Test**
   - Matching tenant → return cached data
   - Mismatched tenant → return null, log error

### Integration Tests

1. **Cross-Tenant Scenario**
   - Org A request → cache stored
   - Org B identical request → cache miss (not Org A's data)
   - Org B gets fresh response, cached separately

2. **Key Collision Test**
   - Two different tenants, identical prompts
   - Verify separate cache entries
   - Verify no cross-contamination

## Implementation Approach

### Files to Modify

| File                                     | Change                                                   |
| ---------------------------------------- | -------------------------------------------------------- |
| `src/services/cache.ts`                  | Add tenant context to keys and entries, validation logic |
| `src/core/pipeline.ts`                   | Pass tenant context from API key validation to cache ops |
| `src/routes/messages.ts`                 | Propagate tenant info from auth to pipeline              |
| `tests/unit/cache.test.ts`               | New: unit tests for tenant isolation                     |
| `tests/integration/cache-tenant.test.ts` | New: integration tests for cross-tenant scenarios        |

### Implementation Order

1. **Extend CacheEntry interface** — Add `tenantId` field
2. **Modify key generation** — Prefix with tenant identifier
3. **Add validation on get()** — Check tenant ownership
4. **Update set()** — Store tenant metadata
5. **Wire tenant context** — Pipeline → Cache service
6. **Add tests** — Unit + integration

## Validation Architecture

### Observable Behaviors

1. Cache keys contain tenant prefix (verifiable via Redis inspection)
2. Cache entries have tenantId field (verifiable via entry inspection)
3. Cross-tenant requests never return wrong data (verifiable via integration tests)
4. Mismatch attempts logged as ERROR (verifiable via log inspection)
5. Metrics emitted for monitoring (verifiable via metrics system)

### Test Commands

```bash
# Unit tests
npx vitest run tests/unit/cache.test.ts

# Integration tests
npx vitest run tests/integration/cache-tenant.test.ts

# Full test suite
npm run test:run
```

## Security Considerations

### Defense-in-Depth (Per D-06)

Both preventive and detective controls:

- **Preventive:** Tenant-prefixed keys reduce collision probability
- **Detective:** Entry validation catches any collision or bypass attempts

### Monitoring Recommendations

1. **Alert on tenant mismatch** — Could indicate attack or misconfiguration
2. **Track cache hit rate per tenant** — Abnormal patterns indicate issues
3. **Log retention** — Keep security logs for forensic analysis

## Sources

- `.planning/research/PITFALLS.md` — Pitfall #2: Cross-tenant cache leakage
- `.planning/research/SUMMARY.md` — Phase 1 recommendations
- `.planning/codebase/CONCERNS.md` — Security considerations
- `src/services/cache.ts` — Current implementation
- `src/services/tenancy/index.ts` — Tenant context extraction

---

_Phase: 01-security-multi-tenant-hardening_
_Researched: 2026-03-23_
