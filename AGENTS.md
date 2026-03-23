# AGENTS.md - Agentic Coding Guidelines

> This file provides guidelines for AI agents working in this repository.

## Project Overview

LLM Gateway - Anthropic OpenAI Bridge service with enterprise features including multi-tenancy, budget enforcement, and Redis-backed caching/rate limiting.

- **Stack**: Node.js/TypeScript ESM (Node >= 20.0.0), Fastify, Zod, Vitest, Drizzle ORM, Redis
- **Database**: SQLite (via better-sqlite3 + Drizzle ORM)
- **Cache/Rate Limiting**: Redis (via ioredis)
- **Monorepo**: Main service + admin-ui workspace

## Commands

### Development

```bash
npm run dev          # Start server with hot reload (tsx watch)
npm run build        # Compile TypeScript to dist/
npm run start        # Run production server from dist/
```

### Admin UI

```bash
npm run dev:admin    # Start admin UI (port 5173)
npm run dev:all      # Run both server and admin UI
npm run build:admin   # Build admin UI for production
```

### Testing

```bash
npm test             # Run all tests (watch mode)
npm run test:run     # Run all tests once
npm run test:coverage # Run tests with coverage report

# Run a single test file
npx vitest run tests/unit/schemas.test.ts

# Run tests matching a pattern
npx vitest run -t "should validate"

# Run only unit/integration tests
npx vitest run tests/unit/
npx vitest run tests/integration/
```

### Linting & Formatting

```bash
npm run lint         # Run ESLint
npm run lint:fix     # Run ESLint with auto-fix
npm run format       # Format code with Prettier
npm run typecheck    # Type check without emitting
```

## Code Style

### Prettier (enforced)

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always"
}
```

### ESLint Rules (from `eslint.config.mjs`)

- TypeScript ESLint recommended
- No unused variables (prefix with `_` to ignore): `@typescript-eslint/no-unused-vars`
- No explicit `any`: `@typescript-eslint/no-explicit-any` (warn)
- No `console.log`: `no-console` (warn)
- No non-null assertions: `@typescript-eslint/no-non-null-assertion` (warn)

### TypeScript

- Strict mode enabled
- Target: ES2022, Module: ESNext
- ModuleResolution: bundler
- ESModuleInterop: true
- ForceConsistentCasingInFileNames: true
- noUnusedLocals: true, noUnusedParameters: true

### Naming Conventions

| Type                     | Convention      | Example                 |
| ------------------------ | --------------- | ----------------------- |
| Variables/functions      | camelCase       | `handleMessage`         |
| Classes/interfaces/types | PascalCase      | `ProviderConfig`        |
| Constants                | SCREAMING_SNAKE | `PROVIDER_TYPES`        |
| Files                    | kebab-case      | `streaming-pipeline.ts` |
| Env vars                 | SCREAMING_SNAKE | `PRIMARY_API_KEY`       |

### Import Conventions (ESM)

- Use `.js` extension for local imports
- Import order: built-ins → external → local → type imports
- Use `import type` for type-only imports

```typescript
import { handleMessage } from './adapters/index.js';
import type { ProviderConfig } from './providers/base.js';
```

### Workspace Imports

```typescript
import { someUtil } from 'admin-ui/src/utils/some-util';
```

## Architecture

### Directory Structure

```
src/
├── adapters/           # Request/response format conversion
├── admin/              # Admin API routes (orgs, teams, users, etc.)
├── config/             # Environment-based configuration
├── core/                # Core request processing pipeline
├── db/                 # Database schema and connection (Drizzle ORM)
├── providers/          # Abstract provider interface & implementations
├── routes/             # Fastify HTTP endpoints
├── schemas/            # Zod validation schemas
├── server/             # Fastify server setup
├── services/           # Core business logic
│   ├── cache.ts        # Redis-backed caching
│   ├── rate-limit/     # Redis-backed rate limiting
│   └── tenancy/        # Multi-tenancy service (Orgs/Teams/Users)
├── streaming/          # SSE stream processing pipeline
└── utils/              # Utility functions

admin-ui/               # React/Vite admin dashboard (React 18, TanStack Query, Tailwind)
tests/
├── unit/               # Unit tests
├── integration/        # Integration tests
└── fixtures/           # Test fixtures
```

### Request Flow

1. Route receives request (`src/routes/`)
2. Schema validation with Zod (`src/schemas/`)
3. API key validation via TenancyService
4. Rate limit check via RateLimiter
5. Budget check via BudgetService
6. Cache lookup via CacheService
7. Adapter normalizes request (`src/adapters/`)
8. Provider executes API call (`src/providers/`)
9. Response denormalized to Anthropic format
10. Streaming events processed in `src/streaming/`
11. Usage logged and spend updated

## Error Handling

### Provider Errors

Use `classifyError()` from `src/providers/errors.js`:

```typescript
import { classifyError } from '../providers/errors.js';

try {
  await someOperation();
} catch (error) {
  const providerError = classifyError(error, 'provider-name');
  // Has: type, message, statusCode, param, isRetryable
}
```

### Error Types (from `src/providers/base.js`)

- `INVALID_REQUEST` - 400
- `AUTHENTICATION` - 401
- `PERMISSION` - 403
- `NOT_FOUND` - 404
- `RATE_LIMIT` - 429
- `OVERLOADED` - 503
- `INTERNAL` - 500
- `TIMEOUT` - 408
- `NETWORK` - 0
- `UNKNOWN` - 500

## Validation Schemas

All API validation uses Zod in `src/schemas/`:

- `anthropic.ts` - Anthropic API schemas
- `openai.ts` - OpenAI API schemas
- `canonical.ts` - Internal normalized format

Always validate with `schema.safeParse()`:

```typescript
const result = AnthropicMessageRequestSchema.safeParse(request.body);
if (!result.success) {
  return reply.status(400).send({ error: result.error.errors });
}
const validated = result.data;
```

## Testing Guidelines

### Test Structure

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('ComponentName', () => {
  beforeEach(() => {
    /* Setup */
  });
  afterEach(() => {
    /* Cleanup */
  });

  describe('methodName', () => {
    it('should do something specific', () => {
      const result = someFunction(input);
      expect(result).toBe(expected);
    });

    it.each([
      [input1, expected1],
      [input2, expected2],
    ])('should handle %s', (input, expected) => {
      const result = someFunction(input);
      expect(result).toBe(expected);
    });
  });
});
```

### Test Location

- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- Test fixtures: `tests/fixtures/`

### Mocking Example

```typescript
vi.mock('../some-module.js', () => ({
  someFunction: vi.fn().mockReturnValue('mocked value'),
}));
```

## API Endpoints

### Public API (Proxy)

| Method | Path                   | Description                        |
| ------ | ---------------------- | ---------------------------------- |
| GET    | `/health`              | Health check                       |
| GET    | `/ready`               | Readiness check                    |
| GET    | `/v1/models`           | List available models              |
| POST   | `/v1/chat/completions` | OpenAI-compatible chat completions |
| POST   | `/v1/messages`         | Anthropic messages endpoint        |
| POST   | `/v1/messages/stream`  | Streaming messages                 |
| POST   | `/v1/embeddings`       | Embeddings endpoint                |

### Admin API (Protected)

| Method | Path                            | Description              |
| ------ | ------------------------------- | ------------------------ |
| GET    | `/admin/health`                 | Overall health status    |
| GET    | `/admin/providers`              | Provider configuration   |
| PUT    | `/admin/providers/:id`          | Update provider          |
| GET    | `/admin/models`                 | Model mappings           |
| POST   | `/admin/models`                 | Add mapping              |
| DELETE | `/admin/models/:anthropicModel` | Delete mapping           |
| GET    | `/admin/keys`                   | List API keys            |
| POST   | `/admin/keys`                   | Create API key           |
| PUT    | `/admin/keys/:id`               | Update API key           |
| DELETE | `/admin/keys/:id`               | Delete API key           |
| POST   | `/admin/keys/:id/rotate`        | Rotate API key           |
| POST   | `/admin/keys/:id/reset-spend`   | Reset spend counter      |
| GET    | `/admin/orgs`                   | List organizations       |
| POST   | `/admin/orgs`                   | Create organization      |
| PUT    | `/admin/orgs/:id`               | Update organization      |
| DELETE | `/admin/orgs/:id`               | Delete organization      |
| GET    | `/admin/teams`                  | List teams               |
| POST   | `/admin/teams`                  | Create team              |
| PUT    | `/admin/teams/:id`              | Update team              |
| DELETE | `/admin/teams/:id`              | Delete team              |
| GET    | `/admin/users`                  | List users               |
| POST   | `/admin/users`                  | Create user              |
| PUT    | `/admin/users/:id`              | Update user              |
| DELETE | `/admin/users/:id`              | Delete user              |
| GET    | `/admin/logs`                   | Request logs (paginated) |
| DELETE | `/admin/logs`                   | Clear all logs           |
| GET    | `/admin/logs/stream`            | Live log streaming (SSE) |
| GET    | `/admin/stats`                  | Usage statistics         |

### Admin Authentication

Set `ADMIN_TOKEN` env var. Include in requests:

```
Authorization: Bearer {ADMIN_TOKEN}
```

## Environment Variables

```bash
# Server
SERVER_PORT=3000
SERVER_HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://user:pass@host:5432/db
DATABASE_TYPE=sqlite  # or 'postgresql'

# Redis
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true

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
RATE_LIMIT_TIME_WINDOW=1 minute

# Caching
CACHE_ENABLED=true
CACHE_TTL=3600

# Logging
LOG_LEVEL=info
LOG_PRETTY=true
```
