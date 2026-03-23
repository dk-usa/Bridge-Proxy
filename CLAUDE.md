<!-- GSD:project-start source:PROJECT.md -->
## Project

**LLM Gateway**

LLM Gateway is an Anthropic-OpenAI bridge service with enterprise features including multi-tenancy, budget enforcement, and Redis-backed caching/rate limiting. It proxies LLM API requests to multiple providers (OpenAI, Anthropic, Azure, Google, Cohere, Mistral) while normalizing responses to both OpenAI and Anthropic formats.

**Core Value:** Provide a unified API gateway that abstracts away provider differences and enables enterprise features (multi-tenancy, rate limiting, budgets) across multiple LLM providers.

### Constraints

- **Tech Stack**: Node.js >= 20.0.0, TypeScript, Fastify, Drizzle ORM, SQLite, Redis
- **API Compatibility**: Must maintain backward compatibility with OpenAI and Anthropic API formats
- **Performance**: Sub-100ms overhead for non-streaming requests
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript 5.7.3 - Main application language
- ES2022 - Target ECMAScript version
- JavaScript (ESM) - Admin UI built with Vite
- CSS - Tailwind CSS for styling
## Runtime
- Node.js >= 20.0.0 - Required runtime version
- npm - Version from package-lock.json
- Lockfile: `package-lock.json` (present)
## Frameworks
- Fastify 5.2.0 - HTTP server framework
- Zod 3.24.1 - Schema validation
- Vitest 4.1.0 - Test runner
- TypeScript ESLint 8.21.0 - Type checking during tests
- TypeScript 5.7.3 - TypeScript compiler
- tsx 4.19.2 - TypeScript execute for development
- ESLint 9.18.0 - Linting
- Prettier 3.4.2 - Code formatting
## Key Dependencies
- `@ai-sdk/openai` 3.0.41 - OpenAI-compatible SDK
- `@ai-sdk/anthropic` 3.0.58 - Anthropic AI SDK
- `@anthropic-ai/sdk` 0.39.0 - Anthropic SDK
- `openai` 4.77.0 - OpenAI Node.js SDK
- `better-sqlite3` 12.8.0 - SQLite driver
- `drizzle-orm` 0.45.1 - ORM
- `drizzle-kit` 0.31.10 - Database migrations (dev)
- `ioredis` 5.10.1 - Redis client
- `@fastify/cors` 10.0.1 - CORS support
- `@fastify/helmet` 13.0.0 - Security headers
- `@fastify/rate-limit` 10.1.1 - Rate limiting
- `pino` 9.6.0 - Logging framework
- `pino-pretty` 11.3.0 - Pretty print logs
- `zod` 3.24.1 - Schema validation
- `zod-to-json-schema` 3.24.1 - JSON schema generation
- `ws` 8.18.0 - WebSocket support
- `dotenv` 17.3.1 - Environment variable loading
## Configuration
- Configuration loaded from `process.env`
- Schema validation via Zod in `src/config/schema.ts`
- Config types defined in `src/config/index.ts`
- `tsconfig.json` - TypeScript configuration
- `vitest.config.ts` - Test configuration
- `eslint.config.mjs` - ESLint configuration
- `.prettierrc` - Prettier configuration
## Platform Requirements
- Node.js >= 20.0.0
- npm (comes with Node)
- Node.js >= 20.0.0
- SQLite (file-based, bundled with better-sqlite3)
- Redis (optional, for caching and rate limiting)
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Pattern: kebab-case
- Example: `streaming-pipeline.ts`, `api-keys.ts`, `rate-limit.ts`
- Pattern: camelCase
- Example: `handleMessage`, `normalizeAnthropicRequest`, `createProvider`
- Pattern: camelCase
- Example: `mockConfig`, `effectiveKey`, `validatedRequest`
- Pattern: PascalCase
- Example: `ProviderConfig`, `AnthropicMessageRequest`, `FastifyInstance`
- Pattern: SCREAMING_SNAKE
- Example: `PROVIDER_TYPES`, `ANTHROPIC_MESSAGE_ROLES`, `PROVIDER_ERROR_TYPES`
- Pattern: SCREAMING_SNAKE
- Example: `PRIMARY_API_KEY`, `SERVER_PORT`, `LOG_LEVEL`
## Code Style
- Tool: Prettier (version 3.4.2)
- Config file: `.prettierrc`
- Key settings:
- Tool: ESLint (version 9.18.0) with typescript-eslint
- Config file: `eslint.config.mjs`
- Key rules:
- Strict mode enabled
- Target: ES2022, Module: ESNext
- ModuleResolution: bundler
- ESModuleInterop: true
- ForceConsistentCasingInFileNames: true
- noUnusedLocals: true, noUnusedParameters: true
## Import Organization
- Always use `.js` extension for local imports (ESM requirement)
- Example: `import { handleMessage } from './adapters/index.js';`
- Use `import type` for type-only imports to improve performance
- Example: `import type { ProviderConfig } from '../providers/base.js';`
- Example: `import { someUtil } from 'admin-ui/src/utils/some-util';`
## Error Handling
- Use `classifyError()` from `src/providers/errors.js`
- Returns typed error with: type, message, statusCode, param, isRetryable, provider
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
## Logging
- Use logger from config: `import { getLogger } from '../config/index.js';`
- Avoid `console.log` (ESLint warns against it)
- Use appropriate log levels: `logger.debug`, `logger.info`, `logger.warn`, `logger.error`
## Validation Schemas
- `src/schemas/anthropic.ts` - Anthropic API schemas
- `src/schemas/openai.ts` - OpenAI API schemas
- `src/schemas/canonical.ts` - Internal normalized format
## Comments
- Complex business logic that isn't self-evident
- Non-obvious workarounds or decisions
- Public API documentation (JSDoc for functions)
- Use for public function documentation
- Include @param and @returns types
- Example:
## Function Design
- Prefer explicit typing for function parameters
- Use options objects for functions with many optional parameters
- Always declare return types for exported functions
- Use `async/await` consistently
- Handle errors with try/catch
## Module Design
- Use named exports for clarity
- Create `index.ts` barrel files for convenient imports
- Common in `src/adapters/index.ts`, `src/providers/index.ts`, `src/schemas/index.ts`
- Use to simplify import paths
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- **Multi-provider abstraction**: Supports OpenAI-compatible, Anthropic, Azure, Google, Cohere, Mistral backends through a unified Provider interface
- **Request/Response transformation**: Adapters normalize incoming requests to provider-specific formats and denormalize responses back to client format
- **Admin management layer**: In-memory store with admin API for managing providers, model mappings, and request logs
- **Middleware pipeline**: Request processing flows through validation, auth, rate limiting, budget checks, caching, and execution
## Layers
- Purpose: Fastify HTTP server setup with CORS, rate limiting, helmet security
- Location: `src/server/index.ts`
- Contains: Fastify instance configuration, plugin registration, route registration
- Depends on: Fastify ecosystem packages (@fastify/cors, @fastify/helmet, @fastify/rate-limit)
- Used by: Entry point `src/index.ts`
- Purpose: HTTP endpoint handlers and request routing
- Location: `src/routes/`
- Contains: Public API routes (`messages.ts`, `models.ts`, `chat-completions.ts`, `embeddings.ts`)
- Depends on: Schemas, core pipeline, config
- Used by: Server layer via `src/routes/index.ts`
- Purpose: Request processing orchestration and provider invocation
- Location: `src/core/pipeline.ts`
- Contains: `processRequest()`, `processStreamingRequest()` - orchestrates model resolution, request building, provider calls, response conversion
- Depends on: Admin store, adapters, pricing service
- Used by: Routes layer
- Purpose: Request/Response format conversion between formats
- Location: `src/adapters/`
- Contains: `request.ts` - converts Anthropic ↔ OpenAI formats for messages, content blocks, tools, tool choices
- Depends on: Schema definitions
- Used by: Core pipeline, streaming pipeline
- Purpose: Abstract provider interface and implementations
- Location: `src/providers/`
- Contains: `base.ts` - Provider interface definition; `openai-compatible.ts`, `anthropic.ts`, `azure.ts`, `google.ts`, `cohere.ts`, `mistral.ts` - implementations
- Depends on: Zod for validation
- Used by: Provider registry service
- Purpose: Business logic and state management
- Location: `src/services/`
- Contains:
- Depends on: Redis (optional), database
- Used by: Admin store, core pipeline, routes
- Purpose: Request/Response validation schemas
- Location: `src/schemas/`
- Contains: `anthropic.ts`, `openai.ts`, `canonical.ts` - Zod schemas for API validation
- Depends on: Zod
- Used by: Routes, adapters
- Purpose: Admin API routes and authentication
- Location: `src/admin/`
- Contains: `index.ts` - admin route registration; `middleware.ts` - admin token auth; individual routers for providers, models, logs, traces, api-keys, orgs, teams, users
- Depends on: Admin store, config
- Used by: Server layer
- Purpose: Environment-based configuration management
- Location: `src/config/`
- Contains: `index.ts` - config loading from env vars; `schema.ts` - config validation
- Depends on: pino (logging), dotenv
- Used by: All layers
- Purpose: SSE stream processing pipeline
- Location: `src/streaming/`
- Contains: `pipeline.ts`, `stream-parser.ts`, `event-translator.ts`, `sse-writer.ts`
- Depends on: Adapters
- Used by: Core pipeline (streaming variants)
## Data Flow
## Key Abstractions
- Purpose: Abstract LLM provider implementation
- Location: `src/providers/base.ts`
- Examples: `OpenAICompatibleProvider`, `AnthropicProvider`, `AzureProvider`
- Pattern: Interface with `listModels()`, `createMessageNonStreaming()`, `createMessageStreaming()`, `createEmbedding()`, `healthcheck()`
- Purpose: Central state management for admin operations
- Location: `src/admin-store.ts`
- Pattern: Singleton class wrapping service layer (provider registry, model mapping, request logger)
- Used by: All admin routes, core pipeline for model resolution
- Purpose: Request/Response caching with dual-backend (Redis + memory)
- Location: `src/services/cache.ts`
- Pattern: LRU fallback to memory when Redis unavailable
- Key method: `generateRequestKey()` - SHA256 hash of model + messages + params
- Purpose: Per-identifier rate limiting with sliding window or token bucket
- Location: `src/services/rate-limit/index.ts`
- Pattern: Token bucket algorithm via Redis sorted sets, fallback to allow-all when unavailable
## Entry Points
- Location: `src/index.ts`
- Triggers: `npm run dev` or `npm run start`
- Responsibilities: Load config, init logger, initialize admin store from config, start server
- Location: `src/server/index.ts`
- Triggers: Called by main entry
- Responsibilities: Create Fastify instance, register plugins (CORS, helmet, rate-limit), register routes
- Location: `src/routes/index.ts`
- Triggers: Called by server
- Responsibilities: Register request ID hook, response logging hook, health endpoints, API routers, admin routes
## Error Handling
- `classifyError()` in `src/providers/errors.js` maps provider errors to standardized error types with status codes
- Error types: INVALID_REQUEST (400), AUTHENTICATION (401), PERMISSION (403), NOT_FOUND (404), RATE_LIMIT (429), OVERLOADED (503), INTERNAL (500), TIMEOUT (408), NETWORK (0)
- Streaming errors: Written as SSE error events to maintain stream connection
- All errors logged via `adminStore.addLog()` with status 'error'
## Cross-Cutting Concerns
- Framework: Pino logger
- Config: `LOG_LEVEL`, `LOG_PRETTY` env vars
- Patterns: Request/response logging in routes index.ts hooks; provider call logging in pipeline.ts
- Framework: Zod schemas
- Schemas: `src/schemas/anthropic.ts`, `openai.ts`, `canonical.ts`
- Usage: Route handlers call `schema.safeParse()`, admin API uses `toJsonSchema()` for Fastify
- Approach: API key validation via `PRIMARY_API_KEY` config
- Headers: `x-api-key`, `authorization`, `anthropic-auth-token` all accepted
- Admin: `ADMIN_TOKEN` env var for admin API via middleware
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
