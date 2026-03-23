import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { messagesRouter } from './messages.js';
import { modelsRouter } from './models.js';
import { embeddingsRouter } from './embeddings.js';
import { chatCompletionsRouter } from './chat-completions.js';
import { getLogger } from '../config/index.js';
import { generateRequestId } from '../utils/id.js';
import { registerAdminRoutes } from '../admin/index.js';
import { adminStore } from '../admin-store.js';

export interface RequestWithId extends FastifyRequest {
  id: string;
  startTime?: number;
}

export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  const logger = getLogger();

  fastify.addHook('onRequest', async (request: RequestWithId) => {
    request.id = (request.headers['x-request-id'] as string) || generateRequestId();
    request.startTime = Date.now();
  });

  fastify.addHook('onResponse', async (request: RequestWithId, reply: FastifyReply) => {
    const duration = request.startTime ? Date.now() - request.startTime : 0;
    logger.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        duration: `${duration}ms`,
      },
      'Request completed'
    );

    if (request.url.startsWith('/v1/')) {
      const model =
        request.body && typeof request.body === 'object'
          ? (request.body as { model?: string }).model
          : undefined;

      const isError = reply.statusCode >= 400;

      adminStore.addLog({
        id: request.id,
        timestamp: new Date().toISOString(),
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        model,
        provider: 'primary',
        latencyMs: duration,
        status: isError ? 'error' : 'success',
        error: isError ? `HTTP ${reply.statusCode}` : undefined,
      });
    }
  });

  fastify.get('/health', async (_request: FastifyRequest, _reply: FastifyReply) => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  fastify.get('/ready', async (_request: FastifyRequest, _reply: FastifyReply) => {
    return { ready: true };
  });

  await fastify.register(modelsRouter, { prefix: '/v1' });
  await fastify.register(messagesRouter, { prefix: '/v1' });
  await fastify.register(embeddingsRouter, { prefix: '/v1' });
  await fastify.register(chatCompletionsRouter, { prefix: '/v1' });
  await fastify.register(registerAdminRoutes, { prefix: '/admin' });
}
