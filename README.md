# LLM Gateway — Universal AI Proxy

A production-grade API gateway that provides a unified OpenAI-compatible interface to any LLM provider. Route requests to OpenAI, Anthropic, Azure, Google, Cohere, Mistral, and any OpenAI-compatible endpoint through a single API.

Inspired by LiteLLM, but built with TypeScript/Fastify for maximum control and performance.

## Features

- **Universal Provider Support** — OpenAI, Anthropic, Azure, Google, Cohere, Mistral, and any OpenAI-compatible API
- **Unified API** — Single OpenAI-compatible endpoint for all providers
- **Anthropic Native API** — Full `/v1/messages` endpoint support
- **Model Routing** — Route requests to different providers based on model name
- **Multi-Provider Failover** — Automatic fallback when primary provider fails
- **Streaming Support** — SSE streaming with proper event translation
- **Tool/Function Calling** — Function definitions and tool use across providers
- **Rate Limiting** — Redis-backed per-key rate limiting
- **Caching** — Tenant-isolated response caching
- **Multi-Tenant** — API key based tenant isolation
- **Admin Dashboard** — Web UI for managing keys, models, and viewing logs

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                          LLM Gateway                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────┐   ┌──────────┐   ┌──────────┐   ┌──────────┐     │
│  │ OpenAI   │   │Anthropic │   │  Azure   │   │  Google  │     │
│  │ Endpoint │   │ Endpoint │   │ Endpoint │   │ Endpoint │     │
│  └────┬─────┘   └────┬─────┘   └────┬─────┘   └────┬─────┘     │
│       │              │              │              │            │
│       └──────────────┴──────────────┴──────────────┘            │
│                              │                                   │
│                    ┌─────────▼─────────┐                        │
│                    │   Provider Layer   │                        │
│                    │  (Adapter Pattern) │                        │
│                    └─────────┬─────────┘                        │
│                              │                                   │
│                    ┌─────────▼─────────┐                        │
│                    │   Unified Cache    │                        │
│                    │  & Rate Limiting   │                        │
│                    └───────────────────┘                        │
└─────────────────────────────────────────────────────────────────┘
```

### Components

| Component        | Purpose                                            |
| ---------------- | -------------------------------------------------- |
| `src/routes/`    | Fastify HTTP endpoints                             |
| `src/providers/` | Provider adapters (OpenAI, Anthropic, Azure, etc.) |
| `src/adapters/`  | Request/response format conversion                 |
| `src/streaming/` | SSE stream processing pipeline                     |
| `src/services/`  | Cache, rate limiting, logging, tenancy             |
| `src/schemas/`   | Zod validation schemas                             |

## Quick Start

### 1. Install

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Primary Provider (e.g., OpenAI, Groq, Fireworks, etc.)
PRIMARY_API_KEY=sk-...
PRIMARY_BASE_URL=https://api.openai.com/v1
PRIMARY_MODEL=gpt-4o

# Optional: Fallback Provider (e.g., Anthropic)
FALLBACK_API_KEY=sk-ant-...
FALLBACK_BASE_URL=https://api.anthropic.com
FALLBACK_MODEL=claude-sonnet-4-20250514

# Server
SERVER_PORT=3000

# Admin Dashboard
ADMIN_TOKEN=your-secure-token
```

### 3. Start Server

```bash
# Development
npm run dev

# Production
npm run build && npm start
```

### 4. Verify

```bash
curl http://localhost:3000/health
```

## API Endpoints

### OpenAI-Compatible

```bash
# Chat Completions
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $PRIMARY_API_KEY" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# List Models
curl http://localhost:3000/v1/models

# Embeddings
curl http://localhost:3000/v1/embeddings \
  -H "Content-Type: application/json" \
  -d '{"input": "Hello world", "model": "text-embedding-3-small"}'
```

### Anthropic-Compatible

```bash
# Messages (non-streaming)
curl http://localhost:3000/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: $PRIMARY_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{
    "model": "claude-sonnet-4-20250514",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'

# Messages (streaming)
curl http://localhost:3000/v1/messages/stream \
  -H "Content-Type: application/json" \
  -H "x-api-key: $PRIMARY_API_KEY" \
  -d '{"model": "claude-sonnet-4-20250514", "messages": [{"role": "user", "content": "Hello!"}], "stream": true}'
```

## Supported Providers

| Provider           | Type              | Status |
| ------------------ | ----------------- | ------ |
| OpenAI             | openai-compatible | ✅     |
| Anthropic          | anthropic         | ✅     |
| Azure OpenAI       | azure             | ✅     |
| Google AI (Gemini) | google            | ✅     |
| Cohere             | cohere            | ✅     |
| Mistral            | mistral           | ✅     |
| Groq               | openai-compatible | ✅     |
| NVIDIA NIM         | openai-compatible | ✅     |
| Ollama (local)     | openai-compatible | ✅     |
| LM Studio          | openai-compatible | ✅     |
| vLLM               | openai-compatible | ✅     |
| Fireworks AI       | openai-compatible | ✅     |
| Perplexity         | openai-compatible | ✅     |
| Replicate          | openai-compatible | ✅     |

Any provider with an OpenAI-compatible API works out of the box.

## Provider Configuration

### OpenAI-Compatible Providers

```bash
# Groq
PRIMARY_API_KEY=gsk_...
PRIMARY_BASE_URL=https://api.groq.com/openai/v1
PRIMARY_MODEL=llama-3.1-70b-versatile

# Fireworks
PRIMARY_API_KEY=fw_...
PRIMARY_BASE_URL=https://api.fireworks.ai/inference/v1
PRIMARY_MODEL=accounts/fireworks/models/llama-v3-70b-instruct

# Perplexity
PRIMARY_API_KEY=pplx-...
PRIMARY_BASE_URL=https://api.perplexity.ai
PRIMARY_MODEL=llama-3.1-sonar-large-128k-online

# Local Ollama
PRIMARY_API_KEY=ollama
PRIMARY_BASE_URL=http://localhost:11434/v1
PRIMARY_MODEL=llama3

# LM Studio
PRIMARY_API_KEY=lm-studio
PRIMARY_BASE_URL=http://localhost:1234/v1
PRIMARY_MODEL=llama3
```

### Anthropic

```bash
FALLBACK_API_KEY=sk-ant-...
FALLBACK_BASE_URL=https://api.anthropic.com
FALLBACK_MODEL=claude-sonnet-4-20250514
```

### Azure OpenAI

```bash
AZURE_API_KEY=your-azure-key
AZURE_BASE_URL=https://your-resource.openai.azure.com
AZURE_MODEL=gpt-4o
```

### Google AI (Gemini)

```bash
GOOGLE_API_KEY=your-google-key
GOOGLE_MODEL=gemini-pro
```

## Environment Variables

### Server

| Variable          | Default   | Description          |
| ----------------- | --------- | -------------------- |
| `SERVER_HOST`     | `0.0.0.0` | Bind address         |
| `SERVER_PORT`     | `3000`    | HTTP port            |
| `REQUEST_TIMEOUT` | `60000`   | Request timeout (ms) |
| `LOG_LEVEL`       | `info`    | Logging level        |
| `LOG_PRETTY`      | `false`   | Pretty print logs    |

### Primary Provider

| Variable              | Default                     | Description     |
| --------------------- | --------------------------- | --------------- |
| `PRIMARY_API_KEY`     | -                           | API key         |
| `PRIMARY_BASE_URL`    | `https://api.openai.com/v1` | Base URL        |
| `PRIMARY_MODEL`       | -                           | Default model   |
| `PRIMARY_TIMEOUT`     | `60000`                     | Request timeout |
| `PRIMARY_MAX_RETRIES` | `3`                         | Max retries     |

### Fallback Provider

| Variable            | Default | Description     |
| ------------------- | ------- | --------------- |
| `FALLBACK_API_KEY`  | -       | API key         |
| `FALLBACK_BASE_URL` | -       | Base URL        |
| `FALLBACK_MODEL`    | -       | Default model   |
| `FALLBACK_TIMEOUT`  | `60000` | Request timeout |

### Rate Limiting

| Variable                 | Default    | Description             |
| ------------------------ | ---------- | ----------------------- |
| `RATE_LIMIT_ENABLED`     | `true`     | Enable rate limiting    |
| `RATE_LIMIT_MAX`         | `100`      | Max requests per window |
| `RATE_LIMIT_TIME_WINDOW` | `1 minute` | Time window             |

### Caching

| Variable        | Default | Description         |
| --------------- | ------- | ------------------- |
| `CACHE_ENABLED` | `true`  | Enable caching      |
| `CACHE_TTL`     | `3600`  | Cache TTL (seconds) |

### Redis

| Variable        | Default | Description          |
| --------------- | ------- | -------------------- |
| `REDIS_URL`     | -       | Redis connection URL |
| `REDIS_ENABLED` | `false` | Enable Redis         |

## Admin Dashboard

The built-in admin dashboard provides:

- **API Keys** — Create, rotate, and manage API keys
- **Organizations** — Multi-tenant management
- **Teams** — Team-level organization
- **Users** — User management
- **Models** — Model routing and mapping
- **Providers** — Provider configuration
- **Logs** — Request/response logging
- **Live Stream** — Real-time request streaming

```bash
# Start with admin
npm run dev

# Access at http://localhost:3000/admin
# Login with ADMIN_TOKEN
```

## Streaming

### SSE Event Format

```javascript
const response = await fetch('http://localhost:3000/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: 'Bearer $API_KEY',
  },
  body: JSON.stringify({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: 'Count to 5' }],
    stream: true,
  }),
});

for await (const chunk of response.body) {
  console.log(chunk.toString());
}
```

### Event Types

```
event: chat.completion.chunk
data: {"id":"...","choices":[{"delta":{"content":"1"},"index":0}]}

event: chat.completion.content_done
data: {"id":"...","choices":[{"delta":{},"index":0,"finish_reason":"stop"}]}

event: chat.completion.done
data: {"id":"...","usage":{...}}
```

## Claude Code Integration

Configure Claude Code to use the gateway:

```bash
# Configure Claude Code
claude config set apiUrl http://localhost:3000

# Or set in ~/.claude/settings.json
{
  "apiUrl": "http://localhost:3000"
}
```

## Development

```bash
# Install dependencies
npm install

# Run in development
npm run dev

# Run tests
npm test

# Run tests once
npm run test:run

# Lint
npm run lint

# Typecheck
npm run typecheck

# Build
npm run build
```

## Deployment

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Docker Compose

```yaml
version: '3.8'
services:
  gateway:
    build: .
    ports:
      - '3000:3000'
    environment:
      - PRIMARY_API_KEY=${PRIMARY_API_KEY}
      - PRIMARY_BASE_URL=${PRIMARY_BASE_URL}
      - PRIMARY_MODEL=${PRIMARY_MODEL}
    volumes:
      - ./data:/app/data

  redis:
    image: redis:alpine
    ports:
      - '6379:6379'
```

## Limitations

| Feature               | Support               |
| --------------------- | --------------------- |
| Text                  | ✅ Full               |
| Vision/Images         | ✅ Provider-dependent |
| Tool/Function Calling | ✅ Supported          |
| Streaming             | ✅ SSE                |
| Streaming Tools       | ⚠️ Varies by provider |
| Cache Control         | ⚠️ Anthropic-specific |
| Batch Requests        | ❌ Not supported      |

## License

MIT
