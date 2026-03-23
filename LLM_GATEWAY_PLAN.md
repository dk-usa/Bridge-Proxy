# LLM Gateway - Hybrid Architecture

> **Project**: Enterprise LLM Gateway with Hybrid Stack
> **Stack**: Go (Gateway) + Python (AI Logic) + Redis + PostgreSQL + Kafka/NATS
> **Goal**: High-performance LLM gateway inspired by LiteLLM/BricksLLM

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Clients                                          │
│                    (OpenAI/Anthropic/any HTTP client)                        │
└─────────────────────────────┬───────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GO GATEWAY (Performance Layer)                            │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌──────────────────────────┐  │
│  │  Auth    │→ │  Budget  │→ │Rate Limit │→ │   Router                 │  │
│  │ (API Key)│  │ (Check)  │  │ (Redis)   │  │ (Retry/Fallback/LB)     │  │
│  └──────────┘  └──────────┘  └───────────┘  └───────────┬──────────────┘  │
│                                                          │                  │
│  ┌───────────────────────────────────────────────────────▼──────────────┐  │
│  │                    Cache Layer (Redis)                                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Event Publisher (Kafka/NATS)                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                   PYTHON AI LOGIC (Flexibility Layer)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ LiteLLM     │  │ Provider    │  │ Transform   │  │ Guardrails      │  │
│  │ Adapters    │  │ Registry    │  │ (Req/Resp)  │  │ (PII/Content)   │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────────┘  │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                    Retry/Fallback Engine                               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬────────────────────────────────────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
        ┌──────────┐       ┌──────────┐       ┌──────────┐
        │ OpenAI   │       │Anthropic │       │  Azure   │
        └──────────┘       └──────────┘       └──────────┘
```

## Tech Stack

| Layer                | Technology       | Purpose                            |
| -------------------- | ---------------- | ---------------------------------- |
| **Core Gateway**     | Go (Gin/Fiber)   | High-performance proxy, routing    |
| **AI Logic**         | Python (FastAPI) | LLM adapters, transforms, LiteLLM  |
| **Rate Limit/Cache** | Redis            | Distributed caching, rate limiting |
| **Database**         | PostgreSQL       | API keys, billing, user/org data   |
| **Event Bus**        | Kafka / NATS     | Async logging, metrics, events     |
| **Config**           | YAML + ENV       | Declarative configuration          |

## Service Responsibilities

### Go Gateway (Port 8080)

- HTTP request handling (OpenAI-compatible endpoints)
- API key validation (with Redis cache)
- Rate limiting (token bucket, sliding window)
- Budget enforcement
- Request routing to Python AI Logic
- Response streaming (SSE)
- Event publishing to Kafka/NATS
- Health checks, metrics

### Python AI Logic (Port 8081)

- LiteLLM-style provider adapters
- Request/response transformation
- Retry logic with exponential backoff
- Circuit breaker per provider
- Load balancing strategies
- Guardrails (PII detection, content filtering)
- Cost calculation
- Model discovery

## Why This Stack?

| Aspect          | Go Gateway                    | Python AI Logic              |
| --------------- | ----------------------------- | ---------------------------- |
| **Performance** | 10x faster than Node.js       | Not for hot paths            |
| **Ecosystem**   | Low-level HTTP, Redis drivers | Rich LLM SDKs, transformers  |
| **Flexibility** | Static routing, auth          | Dynamic transforms, adapters |
| **Debugging**   | Simple goroutines             | Rich Python AI ecosystem     |

Based on BricksLLM (Go) + LiteLLM (Python) patterns.

## Priority Recommendations

Based on competitive analysis, focusing on high-impact features that differentiate leading gateways:

### Immediate (High Impact)

1. **Intelligent Failover & Load Balancing** - Portkey/LiteLLM's main differentiator
   - Implement retry with exponential backoff + jitter
   - Add circuit breaker pattern
   - Support round-robin and weighted load balancing
   - Priority: **Critical**

2. **Enhanced Caching** - LiteLLM/BricksLLM/Portkey strength
   - Semantic cache key normalization
   - Smarter TTL strategies
   - Predictive cache warming
   - Priority: **High**

3. **Middleware/Guardrail System** - Portkey's key feature
   - Content filtering and PII detection
   - Schema validation middleware
   - Request/response transformation
   - Priority: **High**

### Short-term (Medium Impact)

4. **Observability Enhancements** - Helicone's main strength
   - Detailed telemetry (cost, latency, token usage)
   - Request/response content logging (with privacy)
   - Analytics export
   - Priority: **Medium**

5. **Hierarchical Multi-tenancy** - LiteLLM strength
   - Budget inheritance across hierarchy
   - Better team/org propagation
   - Priority: **Medium**

6. **MCP/Agent Workflow Support** - Multiple gateways
   - Model Context Protocol gateway
   - Agent-to-agent protocol
   - Multi-step pipeline tracing
   - Priority: **Medium**

### Long-term (Lower Priority)

7. **Full Plugin Architecture** - Kong's strength
8. **Advanced Analytics Dashboard** - Helicone strength
9. **Performance Optimizations** - Portkey's WASM approach
10. **Comprehensive Deployment Tooling** - Kubernetes/Helm

## Current Implementation Status

---

## ✅ WHAT WE HAVE (COMPLETED)

### Go Gateway (`go-gateway/`)

| Component                 | Status | File                                    | Description               |
| ------------------------- | ------ | --------------------------------------- | ------------------------- |
| **Server**                | ✅     | `cmd/server/main.go`                    | Fiber-based HTTP server   |
| **Config**                | ✅     | `config.yaml`, `internal/config/`       | YAML + ENV configuration  |
| **Cache (Redis)**         | ✅     | `internal/cache/cache.go`               | Redis + memory fallback   |
| **Cache (Memory)**        | ✅     | `internal/cache/cache.go`               | In-memory fallback        |
| **RateLimit (In-Memory)** | ✅     | `internal/ratelimit/ratelimit.go`       | Token bucket              |
| **RateLimit (Redis)**     | ✅     | `internal/ratelimit/redis_ratelimit.go` | Distributed rate limiting |
| **Middleware**            | ✅     | `internal/middleware/`                  | Auth, rate limit, budget  |
| **Handlers**              | ✅     | `internal/handlers/`                    | Chat completions, models  |
| **Providers**             | ✅     | `internal/providers/`                   | Registry, health tracking |
| **Models**                | ✅     | `internal/models/`                      | Model mapping             |
| **Events**                | ✅     | `pkg/events/events.go`                  | Kafka/NATS stubs          |
| **Logger**                | ✅     | `pkg/logger/logger.go`                  | Structured logging        |
| **AI Logic Client**       | ✅     | `internal/gateway/`                     | HTTP to Python            |

### Python AI Logic (`python-ai-logic/`)

| Component          | Status | File              | Description                      |
| ------------------ | ------ | ----------------- | -------------------------------- |
| **FastAPI Server** | ✅     | `server.py`       | Port 8081                        |
| **AIProxy Core**   | ✅     | `src/core/`       | Retry, circuit breaker           |
| **Adapters**       | ✅     | `src/adapters/`   | OpenAI, Anthropic, Azure, Google |
| **Transforms**     | ✅     | `src/transforms/` | Request/response transforms      |
| **Guardrails**     | ✅     | `src/guardrails/` | PII detection, content filter    |
| **Routing/LB**     | ✅     | `src/routing/`    | Round-robin, weighted, latency   |

### Legacy TypeScript (`src/`)

| Component           | Status    | Description                                       |
| ------------------- | --------- | ------------------------------------------------- |
| **Fastify Server**  | ✅ Legacy | Original server (can be deprecated)               |
| **Multi-Provider**  | ✅ Legacy | OpenAI, Anthropic, Azure, Google, Cohere, Mistral |
| **Tenancy**         | ✅ Legacy | Orgs, teams, users, API keys                      |
| **Budget Tracking** | ✅ Legacy | Per key/user/team/org                             |
| **Rate Limiting**   | ✅ Legacy | Redis-backed                                      |
| **Cache**           | ✅ Legacy | Redis/memory                                      |
| **SSE Streaming**   | ✅ Legacy | Request/response streaming                        |
| **SQLite/DB**       | ✅ Legacy | Drizzle ORM                                       |
| **Admin API**       | ✅ Legacy | CRUD endpoints                                    |
| **Zod Schemas**     | ✅ Legacy | Request validation                                |

---

## 🔧 WHAT NEEDS MODIFICATION (IN PROGRESS)

| Component              | Current | Needed       | Files                        | Priority |
| ---------------------- | ------- | ------------ | ---------------------------- | -------- |
| **Database**           | ✅ Done | ✅ Complete  | `go-gateway/internal/db/`    | ✅ DONE  |
| **Budget Enforcement** | ✅ Done | ✅ Complete  | `internal/middleware/`       | ✅ DONE  |
| **Streaming SSE**      | ✅ Done | ✅ Complete  | `internal/handlers/`         | ✅ DONE  |
| **Health Checks**      | Basic   | Automated    | `internal/providers/`        | MEDIUM   |
| **Admin API**          | Basic   | Enhanced     | `internal/handlers/`         | MEDIUM   |
| **Multi-tenancy**      | Flat    | Hierarchical | `internal/services/tenancy/` | MEDIUM   |

---

## 🆕 WHAT NEEDS IMPLEMENTATION (PENDING)

### High Priority

| Feature                    | Description             | Where to Implement        | Status  |
| -------------------------- | ----------------------- | ------------------------- | ------- |
| **PostgreSQL Integration** | API keys, billing, orgs | `go-gateway/internal/db/` | ✅ DONE |
| **Budget Enforcement**     | Go-side spend tracking  | `internal/middleware/`    | ✅ DONE |
| **Streaming Proxy**        | Go ↔ Python SSE         | `internal/handlers/`      | ✅ DONE |
| **Kafka Events**           | Real event publishing   | `pkg/events/kafka.go`     | ✅ DONE |

### Medium Priority

| Feature             | Description           | Where to Implement               | Status  |
| ------------------- | --------------------- | -------------------------------- | ------- |
| **Health Checks**   | Provider monitoring   | `internal/providers/health.go`   | PENDING |
| **Admin UI**        | React dashboard       | `admin-ui/`                      | PENDING |
| **Analytics API**   | Usage aggregation     | `internal/handlers/analytics.go` | PENDING |
| **Budget Alerting** | Webhook notifications | `internal/services/alerting/`    | PENDING |

### Low Priority

| Feature          | Description            | Where to Implement         | Status  |
| ---------------- | ---------------------- | -------------------------- | ------- |
| **JWT/OAuth2**   | Alternative auth       | `internal/auth/`           | PENDING |
| **MCP Gateway**  | Model Context Protocol | `python-ai-logic/src/mcp/` | PENDING |
| **A2A Protocol** | Agent-to-agent         | `python-ai-logic/src/a2a/` | PENDING |
| **K8s Deploy**   | Helm, manifests        | `deploy/`                  | PENDING |

---

## 📁 DIRECTORY STRUCTURE

```
go-gateway/
├── cmd/server/main.go           # ✅ Main server
├── config.yaml                  # ✅ Configuration
├── internal/
│   ├── config/config.go        # ✅ YAML loader
│   ├── gateway/
│   │   ├── gateway.go         # ✅ Core orchestration
│   │   └── ai_logic_client.go # ✅ Python client
│   ├── handlers/handlers.go    # ✅ HTTP handlers + streaming
│   ├── middleware/middleware.go # ✅ Auth, rate limit, budget
│   ├── cache/cache.go         # ✅ Redis + memory
│   ├── ratelimit/
│   │   ├── ratelimit.go       # ✅ In-memory
│   │   └── redis_ratelimit.go # ✅ Redis distributed
│   ├── providers/providers.go  # ✅ Registry
│   ├── models/models.go       # ✅ Mapping
│   └── db/                    # ✅ PostgreSQL
│       ├── models.go         # ✅ Database models
│       └── postgres.go        # ✅ PostgreSQL client
└── pkg/
    ├── logger/logger.go      # ✅ Logging
    └── events/
        ├── events.go          # ✅ Event types
        └── kafka.go          # ✅ Kafka publisher

python-ai-logic/
├── server.py                   # ✅ FastAPI
├── requirements.txt            # ✅ Dependencies
└── src/
    ├── core/__init__.py       # ✅ AIProxy
    ├── adapters/__init__.py    # ✅ Providers
    ├── transforms/__init__.py  # ✅ Transforms
    ├── guardrails/__init__.py # ✅ PII filter
    ├── routing/__init__.py    # ✅ Load balancing
    ├── mcp/                   # ❌ TODO: MCP
    └── a2a/                  # ❌ TODO: A2A
```

---

## 🚀 QUICK START

```bash
# 1. Start Redis
docker run -d -p 6379:6379 redis:7-alpine

# 2. Start Python AI Logic
cd python-ai-logic
pip install -r requirements.txt
python server.py

# 3. Start Go Gateway
cd go-gateway
go build -o bin/gateway ./cmd/server
./bin/gateway
```

---

## 📋 TODO LIST (PRIORITY ORDER)

### Phase 2: Core Functionality

- [x] PostgreSQL integration (HIGH) ✅ NEW
- [x] Budget enforcement middleware (HIGH) ✅ NEW
- [x] Kafka/NATS events (MEDIUM) ✅ NEW

### Phase 3: Resilience

- [x] Streaming SSE proxy (HIGH) ✅ NEW
- [ ] Health check automation (MEDIUM)
- [ ] Distributed caching (MEDIUM)

### Phase 4: Advanced

- [ ] MCP Gateway (LOW)
- [ ] A2A Protocol (LOW)
- [ ] Plugin system (LOW)

### Phase 5: Production

- [ ] Kubernetes/Helm (LOW)
- [ ] Prometheus metrics (LOW)
- [ ] Load testing (LOW)

## Features (Planned)

### Phase 1: Foundation (Hybrid) - COMPLETED ✓

- [x] Go Gateway core infrastructure
- [x] Python AI Logic core infrastructure
- [x] Go ↔ Python communication
- [x] Provider adapters (OpenAI, Anthropic, Azure, Google)
- [x] Basic rate limiting (in-memory)
- [x] Request/response transforms
- [x] PII detection guardrails

### Phase 2: Core Functionality (Hybrid) - COMPLETED ✓

- [x] Token bucket rate limiter (in-memory)
- [x] Redis-backed distributed rate limiting
- [x] Retry with exponential backoff
- [x] Circuit breaker pattern
- [x] Load balancing strategies
- [x] PostgreSQL persistence ✅ NEW
- [x] Kafka/NATS event publishing ✅ NEW

### Phase 3: Resilience (HIGH PRIORITY)

- [x] Streaming SSE proxy ✅ NEW
- [ ] Health check automation
- [ ] Distributed caching
- [ ] Budget enforcement in Go layer (completed via middleware)
- [ ] Circuit breaker with half-open state

### Phase 4: Advanced Features (MEDIUM PRIORITY)

- [ ] MCP gateway (Model Context Protocol)
- [ ] A2A protocol support (Agent-to-Agent)
- [ ] Plugin architecture
- [ ] OpenAPI documentation
- [ ] SDK generation

### Phase 5: Production (LOWER PRIORITY)

- [ ] Kubernetes/Helm deployment
- [ ] Prometheus metrics
- [ ] Load testing
- [ ] Security audit

## API Endpoints

### Public API (Proxy)

| Method | Path                   | Description                        |
| ------ | ---------------------- | ---------------------------------- |
| GET    | `/health`              | Health check                       |
| GET    | `/ready`               | Readiness check                    |
| GET    | `/v1/models`           | List available models              |
| GET    | `/v1/models/:model`    | Get specific model info            |
| POST   | `/v1/chat/completions` | OpenAI-compatible chat completions |
| POST   | `/v1/messages`         | Anthropic messages endpoint        |
| POST   | `/v1/messages/stream`  | Streaming messages                 |
| POST   | `/v1/embeddings`       | Embeddings endpoint                |

### Admin API (Protected)

| Method | Path                            | Description              |
| ------ | ------------------------------- | ------------------------ |
| GET    | `/admin/health`                 | Overall health status    |
| GET    | `/admin/providers`              | List providers           |
| POST   | `/admin/providers`              | Add provider             |
| PUT    | `/admin/providers/:id`          | Update provider          |
| DELETE | `/admin/providers/:id`          | Delete provider          |
| POST   | `/admin/providers/:id/test`     | Test provider connection |
| GET    | `/admin/models`                 | List model mappings      |
| POST   | `/admin/models`                 | Add model mapping        |
| PUT    | `/admin/models`                 | Bulk update mappings     |
| DELETE | `/admin/models/:anthropicModel` | Delete mapping           |
| GET    | `/admin/keys`                   | List API keys            |
| POST   | `/admin/keys`                   | Create API key           |
| PUT    | `/admin/keys/:id`               | Update API key           |
| DELETE | `/admin/keys/:id`               | Delete API key           |
| POST   | `/admin/keys/:id/rotate`        | Rotate API key           |
| POST   | `/admin/keys/:id/reset-spend`   | Reset spend counter      |
| GET    | `/admin/logs`                   | Request logs (paginated) |
| DELETE | `/admin/logs`                   | Clear all logs           |
| GET    | `/admin/logs/stream`            | Live log streaming (SSE) |
| GET    | `/admin/stats`                  | Usage statistics         |

## Database Schema (PostgreSQL)

```sql
-- Organizations (enterprise tier)
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  budget DECIMAL(12,2),
  budget_reset_at TIMESTAMP,
  spend DECIMAL(12,2) DEFAULT 0,
  request_count INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  budget DECIMAL(12,2),
  budget_reset_at TIMESTAMP,
  spend DECIMAL(12,2) DEFAULT 0,
  request_count INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

-- Teams
CREATE TABLE teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  budget DECIMAL(12,2),
  budget_reset_at TIMESTAMP,
  spend DECIMAL(12,2) DEFAULT 0,
  request_count INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

-- API Keys (encrypted at rest)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash VARCHAR(64) NOT NULL UNIQUE, -- SHA-256 hash of key
  key_value_encrypted TEXT NOT NULL,    -- Encrypted actual key
  name VARCHAR(255) NOT NULL,
  description TEXT,
  user_id UUID REFERENCES users(id),
  team_id UUID REFERENCES teams(id),
  organization_id UUID REFERENCES organizations(id),
  model_restrictions TEXT[],
  budget DECIMAL(12,2),
  budget_reset_at TIMESTAMP,
  spend DECIMAL(12,2) DEFAULT 0,
  request_count INTEGER DEFAULT 0,
  rate_limit INTEGER, -- Requests per minute
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  metadata JSONB
);

-- Usage Logs (partitioned by date)
CREATE TABLE usage_logs (
  id UUID DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id),
  model VARCHAR(255) NOT NULL,
  provider VARCHAR(255),
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost DECIMAL(12,2),
  latency_ms INTEGER,
  status VARCHAR(50),
  error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Model Pricing
CREATE TABLE model_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(255) NOT NULL,
  model VARCHAR(255) NOT NULL,
  input_cost_per_1k DECIMAL(10,6),
  output_cost_per_1k DECIMAL(10,6),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(provider, model)
);
```

## Redis Keys Structure

```
# API Key cache (TTL: 5 minutes)
apikey:{key_hash} → {id, user_id, team_id, budget, spend, rate_limit, ...}

# Rate limiting (token bucket)
ratelimit:{api_key_id} → {tokens, last_refill}

# Response cache
cache:{model}:{hash(messages+params)} → {response, ttl}

# Provider health
health:{provider_id} → {status, latency_ms, last_check, success_count, error_count}

# Spend counters (atomic increments)
spend:{api_key_id}:{YYYY-MM} → {amount}
```

## Environment Variables

```bash
# Server
SERVER_PORT=3000
SERVER_HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
DATABASE_POOL_SIZE=10

# Redis
REDIS_URL=redis://localhost:6379
REDIS_KEY_TTL=300

# Primary Provider
PRIMARY_API_KEY=sk-...
PRIMARY_BASE_URL=https://api.openai.com/v1
PRIMARY_MODEL=gpt-4
PRIMARY_TYPE=openai-compatible

# Fallback Provider
FALLBACK_API_KEY=sk-ant-...
FALLBACK_BASE_URL=https://api.anthropic.com
FALLBACK_MODEL=claude-3-5-sonnet-20240620
FALLBACK_TYPE=anthropic-compatible

# Admin
ADMIN_TOKEN=your-admin-secret-token

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=1 minute

# Caching
CACHE_ENABLED=true
CACHE_TTL=3600

# Logging
LOG_LEVEL=info
LOG_PRETTY=true
```

## Feature Comparison (vs Industry Gateways)

| Feature                      | LiteLLM | Kong | BricksLLM | Helicone | Portkey | This Project |
| ---------------------------- | ------- | ---- | --------- | -------- | ------- | ------------ |
| **Multi-provider routing**   | ✅      | ✅   | ✅        | ✅       | ✅      | ✅ Hybrid    |
| **Virtual API keys**         | ✅      | ✅   | ✅        | ✅       | ✅      | 🟡 Pending   |
| **Spend tracking**           | ✅      | ❌   | ✅        | ✅       | ❌      | 🟡 Pending   |
| **Budget limits**            | ✅      | ❌   | ✅        | ❌       | ❌      | 🟡 Partial   |
| **Rate limiting**            | ✅      | ✅   | ✅        | ❌       | ❌      | ✅ Done      |
| **Response caching**         | ✅      | 🟡   | ✅        | ❌       | ✅      | ✅ Done      |
| **Retries/fallbacks**        | ✅      | ✅   | ✅        | ✅       | ✅      | ✅ Python    |
| **Circuit breaker**          | ✅      | ✅   | ❌        | ❌       | ❌      | ✅ Python    |
| **Load balancing**           | ✅      | ✅   | ✅        | ❌       | ✅      | ✅ Python    |
| **Multi-tenancy (org/team)** | ✅      | 🟡   | ✅        | ❌       | 🟡      | 🟡 Pending   |
| **Database persistence**     | ✅      | ✅   | ✅        | ✅       | ❌      | 🟡 Pending   |
| **Redis caching**            | ✅      | 🟡   | ✅        | ❌       | ❌      | ✅ Done      |
| **MCP gateway**              | ✅      | ✅   | ❌        | ❌       | ✅      | ❌ Planned   |
| **A2A agent support**        | ✅      | ✅   | ❌        | ✅       | ❌      | ❌ Planned   |
| **Cost attribution**         | ✅      | ❌   | ✅        | ✅       | ❌      | 🟡 Pending   |
| **Guardrails/PII detection** | 🟡      | ✅   | ✅        | ❌       | ✅      | ✅ Python    |
| **OpenAPI documentation**    | ✅      | ✅   | ❌        | ❌       | ✅      | ❌ Planned   |
| **Observability/Analytics**  | ✅      | ✅   | ✅        | ✅       | ✅      | 🟡 Basic     |
| **Plugin/extension system**  | ✅      | ✅   | ❌        | ❌       | ✅      | ❌ Planned   |
| **JWT/OAuth2 auth**          | ✅      | ✅   | ❌        | ❌       | ✅      | ❌ Planned   |
| **Streaming SSE**            | ✅      | ✅   | ✅        | ✅       | ✅      | 🟡 Pending   |

Legend: ✅ Done | 🟡 Partial/Pending | ❌ Not started

## Implementation Phases

### Milestone 1: Foundation (Hybrid Architecture) - COMPLETED ✓

- [x] Go Gateway core server (Fiber-based)
- [x] Configuration system (YAML + ENV)
- [x] Python AI Logic server (FastAPI)
- [x] Provider adapters (OpenAI, Anthropic, Azure, Google)
- [x] Go ↔ Python HTTP communication
- [x] Structured logging
- [x] In-memory rate limiter
- [x] Provider registry
- [x] Model mapping service

### Milestone 2: Core Functionality - IN PROGRESS

- [x] Retry with exponential backoff + jitter
- [x] Circuit breaker pattern
- [x] Load balancing (round-robin, weighted, latency-based)
- [x] Request/response transforms
- [x] PII detection guardrails
- [x] Content filtering
- [ ] **Redis-backed distributed rate limiting**
- [ ] **PostgreSQL persistence** (API keys, orgs, billing)
- [ ] **Kafka/NATS event publishing**
- [ ] **Streaming SSE proxy**

### Milestone 3: Resilience & Reliability (HIGH PRIORITY)

- [ ] **Streaming chat completions** (Go ↔ Python SSE)
- [ ] **Health check automation** (periodic provider monitoring)
- [ ] **Budget enforcement** (Go-side spend tracking)
- [ ] **Fallback mechanism** (intelligent model/provider failover)
- [ ] **Distributed caching** (Redis)
- [ ] **Circuit breaker UI** (half-open state management)

### Milestone 4: Observability & Analytics (MEDIUM PRIORITY)

- [ ] **Enhanced telemetry** (cost, latency, token usage)
- [ ] **Request/response logging** (with privacy controls)
- [ ] **Analytics API endpoints** (usage aggregation)
- [ ] **Budget alerting** (webhook notifications)
- [ ] **Agent workflow tracing** (multi-step pipelines)
- [ ] **Prometheus metrics endpoint**

### Milestone 5: Advanced Features (MEDIUM PRIORITY)

- [ ] **Plugin/extension system** (custom providers, middleware)
- [ ] **MCP gateway** (Model Context Protocol support)
- [ ] **A2A protocol support** (Agent-to-agent communication)
- [ ] **Model auto-discovery** (from providers)
- [ ] **OpenAPI documentation**
- [ ] **SDK generation** (TypeScript, Python)

### Milestone 6: Enterprise Features (LOWER PRIORITY)

- [ ] **JWT/OAuth2 authentication**
- [ ] **Fine-grained ACLs**
- [ ] **Multi-tenancy UI** (admin dashboard)
- [ ] **Cost attribution reporting**
- [ ] **API key management UI**

### Milestone 7: Production Deployment

- [ ] Kubernetes/Helm charts
- [ ] Docker Compose setup
- [ ] Load testing
- [ ] Security audit
- [ ] Performance benchmarking
- [ ] Documentation

## Testing Strategy

### Go Gateway Tests

```bash
cd go-gateway
go test ./...
go test -v ./internal/...
go build -o bin/gateway ./cmd/server
```

### Python AI Logic Tests

```bash
cd python-ai-logic
pip install -r requirements.txt
pytest tests/
python -m pytest --cov=src
```

### TypeScript Tests (Legacy)

```bash
npm test
npm run test:run -- tests/unit/
npm run test:coverage
```

## Running the Services

### 1. Start Python AI Logic (Port 8081)

```bash
cd python-ai-logic
pip install -r requirements.txt
python server.py
```

### 2. Start Go Gateway (Port 8080)

```bash
cd go-gateway
./bin/gateway
# Or: go run cmd/server/main.go
```

### 3. Environment Variables

```bash
# Go Gateway
export CONFIG_PATH=go-gateway/config.yaml
export ADMIN_TOKEN=your-secret-token

# Python AI Logic
export PRIMARY_API_KEY=sk-...
export PRIMARY_BASE_URL=https://api.openai.com/v1
export FALLBACK_API_KEY=sk-ant-...
export FALLBACK_BASE_URL=https://api.anthropic.com
```

## Performance Targets

| Metric                    | Target      |
| ------------------------- | ----------- |
| Cached request latency    | <50ms P95   |
| Uncached request latency  | <100ms P95  |
| Rate limit check overhead | <1ms        |
| Throughput (4 vCPU)       | >1000 RPS   |
| Memory usage              | <512MB base |
| Startup time              | <2 seconds  |

## Contributing

1. Read this plan for context and competitive analysis
2. Check the implementation status above
3. **Pick a service to work on:**
   - **Go Gateway** (`go-gateway/`) - Performance layer, auth, rate limiting
   - **Python AI Logic** (`python-ai-logic/`) - Adapters, transforms, guardrails
4. Follow the code style:
   - **Go**: Standard Go conventions, `gofmt` formatting
   - **Python**: PEP 8, type hints
5. Build and test before submitting:
   - Go: `go build ./... && go test ./...`
   - Python: `pytest tests/`
6. Update this plan as work progresses

## References

### Primary Gateways

- [LiteLLM GitHub](https://github.com/BerriAI/litellm) - Python SDK + proxy, AWS partnered
- [LiteLLM Documentation](https://docs.litellm.ai/) - Comprehensive proxy docs

### Comparative Gateways

- [Kong Gateway](https://github.com/Kong/kong) - Enterprise API gateway with AI plugin suite
- [BricksLLM](https://github.com/bricks-cloud/BricksLLM) - Go-based enterprise gateway with guardrails
- [Helicone](https://github.com/Helicone/helicone) - AI gateway with LLM observability focus
- [Portkey AI Gateway](https://github.com/Portkey-AI/gateway) - Rust/WASM, sub-millisecond latency

### API References

- [OpenAI API Reference](https://platform.openai.com/docs/api-reference)
- [Anthropic API Reference](https://docs.anthropic.com/)
- [NVIDIA NIM API](https://docs.nvidia.com/)
