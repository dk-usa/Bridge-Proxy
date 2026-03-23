import { FastifyRequest, FastifyReply } from 'fastify';
import { getConfig } from '../config/index.js';

export interface AuthenticatedRequest extends FastifyRequest {
  adminAuth?: {
    authenticated: boolean;
    token?: string;
  };
}

export async function adminAuthMiddleware(
  request: AuthenticatedRequest,
  reply: FastifyReply
): Promise<void> {
  const config = getConfig();
  const adminToken = config.admin?.token;

  if (!adminToken) {
    request.adminAuth = { authenticated: true };
    return;
  }

  const authHeader = request.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    reply.status(401).send({
      type: 'error',
      error: {
        type: 'authentication_error',
        message: 'Missing or invalid Authorization header',
      },
    });
    return;
  }

  const token = authHeader.slice(7);

  if (token !== adminToken) {
    reply.status(401).send({
      type: 'error',
      error: {
        type: 'authentication_error',
        message: 'Invalid admin token',
      },
    });
    return;
  }

  request.adminAuth = { authenticated: true, token };
}

export function requireAdminAuth(
  request: AuthenticatedRequest,
  reply: FastifyReply,
  done: (error?: Error) => void
): void {
  const config = getConfig();
  const adminToken = config.admin?.token;

  if (!adminToken) {
    done();
    return;
  }

  if (!request.adminAuth?.authenticated) {
    reply.status(401).send({
      type: 'error',
      error: {
        type: 'authentication_error',
        message: 'Admin authentication required',
      },
    });
    done();
    return;
  }

  done();
}

export function getAuthHeader(token?: string): Record<string, string> {
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
}
