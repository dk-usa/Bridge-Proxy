# Phase 1: Security & Multi-Tenant Hardening - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 01-security-multi-tenant-hardening
**Areas discussed:** Cache validation strategy

---

## Cache Validation Strategy

| Option                           | Description                                                           | Selected |
| -------------------------------- | --------------------------------------------------------------------- | -------- |
| Reject mismatch (strict)         | If tenant_id mismatches, reject cached response and fetch fresh       |          |
| Key-based isolation (preventive) | Include tenant_id in key generation so mismatches never occur         |          |
| Both (recommended)               | Include tenant_id in key + validate on retrieval for defense-in-depth | ✓        |

**User's choice:** Both (recommended) — defense-in-depth approach

---

## Tenant ID Storage

| Option                     | Description                                                   | Selected |
| -------------------------- | ------------------------------------------------------------- | -------- |
| Include tenant_id in entry | Store tenant_id in cache entry metadata for validation        | ✓        |
| Key-only (no metadata)     | Rely only on key prefix for isolation, no metadata validation |          |

**User's choice:** Include tenant_id in entry for validation

---

## Error Handling

| Option           | Description                                                    | Selected |
| ---------------- | -------------------------------------------------------------- | -------- |
| Log and continue | Log warning, proceed with fresh provider call (non-disruptive) |          |
| Fail request     | Throw error and reject request (strict security)               |          |
| Metrics only     | Metrics only, no logs (minimal overhead)                       |          |

**User's choice:** Modified — "strict + graceful fallback": Do NOT use cached response, log as ERROR, emit metric, fetch fresh from provider, only fail if repeated/spike

---

## Tenant ID Scope

| Option              | Description                                                   | Selected |
| ------------------- | ------------------------------------------------------------- | -------- |
| Organization ID     | Use organizationId from API key (most common isolation level) |          |
| Organization + Team | Combine org + team for stricter isolation                     | ✓        |
| Full hierarchy      | Full path: org/team/user (most restrictive)                   |          |

**User's choice:** Organization + Team

---

## Test Coverage

| Option            | Description                                       | Selected |
| ----------------- | ------------------------------------------------- | -------- |
| Unit tests        | Unit tests for cache service tenant validation    | ✓        |
| Integration tests | End-to-end tests simulating cross-tenant requests | ✓        |
| Collision tests   | Dedicated test for cache key collision scenarios  | ✓        |

**User's choice:** All of the above

---

## Agent's Discretion

- Exact logging format and metric names
- Threshold for "repeated/spike" detection
- Implementation details of key generation method

## Deferred Ideas

None — discussion stayed within phase scope.
