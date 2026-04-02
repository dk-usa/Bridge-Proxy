# LLM Gateway

## What This Is

LLM Gateway is a comprehensive multi-provider LLM gateway (Anthropic-OpenAI bridge) with enterprise features including multi-tenancy, budget enforcement, tenant-isolated caching, SSE heartbeat for streaming, provider health tracking, and semantic cache for cost optimization. It proxies LLM API requests to multiple providers while normalizing responses to both OpenAI and Anthropic formats.

## Core Value

Provide a unified API gateway that abstracts away provider differences and enables enterprise features (multi-tenancy, rate limiting, budgets, observability) across multiple LLM providers.

## Current State

**Shipped:** v1.0 LLM Gateway Enhancement (2026-04-02)

- 5 phases completed (security, reliability, observability, semantic caching, universal bridge foundation)
- 13,153 LOC TypeScript
- 17/20 requirements validated (3 partial with integration gaps)
- 37 tasks completed across 10 plans

**Known Gaps (Tech Debt):**

- BRIDGE-03: VirtualKeyService created but not integrated in request pipeline
- BRIDGE-04: RoutingService created but never called from pipeline
- BRIDGE-05: ObservabilityService created but not collecting metrics during requests

## Requirements

### Validated

- ✓ OpenAI-compatible `/v1/chat/completions` endpoint — existing
- ✓ Anthropic-compatible `/v1/messages` endpoint — existing
- ✓ `/v1/models` listing endpoint — existing
- ✓ `/v1/embeddings` endpoint — existing
- ✓ Multi-provider support (OpenAI, Anthropic, Azure, Google, Cohere, Mistral) — existing
- ✓ SQLite database with Drizzle ORM — existing
- ✓ Redis caching and rate limiting — existing
- ✓ Multi-tenancy (Orgs, Teams, Users) — existing
- ✓ Admin API with API key management — existing
- ✓ Request logging and usage tracking — existing
- ✓ Budget enforcement per org/team — existing
- ✓ Cache tenant isolation (SEC-01, SEC-02, SEC-03) — v1.0
- ✓ SSE heartbeat mechanism (REL-01, REL-02, REL-03) — v1.0
- ✓ Provider health tracking (OBS-01, OBS-02, OBS-03, OBS-04) — v1.0
- ✓ Semantic cache with embedding similarity (CACHE-01, CACHE-02, CACHE-03, CACHE-04) — v1.0
- ✓ Dynamic provider configuration via YAML (BRIDGE-01) — v1.0 (partial)
- ✓ Provider expansion foundation (BRIDGE-02) — v1.0 (partial)

### Active

- [ ] Integrate RoutingService into request pipeline (BRIDGE-04)
- [ ] Integrate VirtualKeyService budget enforcement (BRIDGE-03)
- [ ] Wire ObservabilityService metrics collection (BRIDGE-05)
- [ ] Add additional LLM providers
- [ ] Enhance admin UI dashboard
- [ ] Implement webhook notifications

### Out of Scope

- Mobile SDKs — defer to future, web API sufficient
- GraphQL API — REST API sufficient for current needs
- Real-time WebSocket chat — not needed for API gateway use case
- Prompt playground UI — out of scope for gateway service

## Context

Node.js/TypeScript gateway service using Fastify, Drizzle ORM, SQLite, and Redis. Well-structured with clear separation between providers, adapters, routes, and services. Admin UI is React/Vite application.

**Architectural patterns established:**

- Provider abstraction layer for multi-provider support
- Adapter pattern for format conversion (Anthropic ↔ OpenAI)
- Multi-tenancy service for org/team/user hierarchy
- Redis-backed caching and rate limiting
- Tenant-isolated cache with defense-in-depth (key prefix + entry validation)
- SSE heartbeat mechanism for streaming reliability
- Rolling window provider health tracking
- Semantic cache with cosine similarity matching

## Constraints

- **Tech Stack**: Node.js >= 20.0.0, TypeScript, Fastify, Drizzle ORM, SQLite, Redis
- **API Compatibility**: Must maintain backward compatibility with OpenAI and Anthropic API formats
- **Performance**: Sub-100ms overhead for non-streaming requests

## Key Decisions

| Decision                                  | Rationale                                             | Outcome    |
| ----------------------------------------- | ----------------------------------------------------- | ---------- |
| Use Drizzle ORM                           | Type-safe database access, SQLite for simplicity      | ✓ Good     |
| Redis for caching/rate limiting           | Industry standard, well-understood                    | ✓ Good     |
| Multi-provider abstraction                | Enable provider flexibility and fallback              | ✓ Good     |
| Dual API format support                   | Support both OpenAI and Anthropic clients             | ✓ Good     |
| Tenant-isolated cache keys                | Defense-in-depth: key prefix + entry validation       | ✓ Good     |
| SSE heartbeat for streaming               | Keep connections alive during long responses          | ✓ Good     |
| Provider health tracking                  | Rolling window health calculation with success rate   | ✓ Good     |
| Semantic cache                            | Cosine similarity with Redis-backed embedding storage | ✓ Good     |
| RoutingService created but not integrated | Services built, integration deferred                  | ⚠️ Revisit |
| VirtualKeyService not wired to pipeline   | Admin CRUD works, no enforcement                      | ⚠️ Revisit |
| ObservabilityService not collecting       | Admin API works, no data collection                   | ⚠️ Revisit |

---

_Last updated: 2026-04-02 after v1.0 milestone completion_
