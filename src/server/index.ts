import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { getConfig } from '../config/index.js';
import { registerRoutes } from '../routes/index.js';

export async function createServer(): Promise<FastifyInstance> {
  const config = getConfig();

  const fastify = Fastify({
    logger: config.logging.pretty
      ? {
          level: config.logging.level,
          transport: {
            target: 'pino-pretty',
            options: { colorize: true },
          },
        }
      : {
          level: config.logging.level,
        },
    trustProxy: true,
    requestTimeout: config.server.requestTimeout ?? 60000,
  });

  if (config.cors.enabled) {
    const corsOrigin =
      config.cors.origin === '*'
        ? '*'
        : Array.isArray(config.cors.origin)
          ? config.cors.origin
          : [config.cors.origin];

    const adminUiOrigin = 'http://localhost:5173';
    const allOrigins = corsOrigin.includes(adminUiOrigin)
      ? corsOrigin
      : [...corsOrigin, adminUiOrigin];

    await fastify.register(cors, {
      origin: allOrigins,
      credentials: true,
    });
  }

  await fastify.register(helmet, {
    contentSecurityPolicy: false,
  });

  if (config.rateLimit.enabled) {
    await fastify.register(rateLimit, {
      max: config.rateLimit.max,
      timeWindow: config.rateLimit.timeWindow,
    });
  }

  await registerRoutes(fastify);

  return fastify;
}

export async function startServer(): Promise<void> {
  const config = getConfig();

  const server = await createServer();

  try {
    await server.listen({ port: config.server.port, host: config.server.host });
    server.log.info(`Server listening on ${config.server.host}:${config.server.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}
