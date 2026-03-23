import type { ErrorResponse } from '../schemas/index.js';

export class BridgeError extends Error {
  public readonly type: string;
  public readonly statusCode: number;
  public readonly param?: string;
  public readonly code?: string;

  constructor(message: string, type: string, statusCode: number, param?: string, code?: string) {
    super(message);
    this.type = type;
    this.statusCode = statusCode;
    this.param = param;
    this.code = code;
  }

  toJSON(): ErrorResponse {
    return {
      type: 'error',
      error: {
        type: this.type,
        message: this.message,
        param: this.param,
        code: this.code,
      },
    };
  }
}

interface OpenAIError {
  status?: number;
  data?: {
    error?: {
      message?: string;
      param?: string;
      code?: string;
    };
  };
}

export function mapOpenAIError(error: unknown): BridgeError {
  if (error instanceof BridgeError) {
    return error;
  }

  const err = error as OpenAIError;

  if (err.status === 400) {
    return new BridgeError(
      err.data?.error?.message ?? 'Invalid request',
      'invalid_request_error',
      400,
      err.data?.error?.param,
      err.data?.error?.code
    );
  }

  if (err.status === 401) {
    return new BridgeError('Invalid API key', 'authentication_error', 401);
  }

  if (err.status === 403) {
    return new BridgeError('Permission denied', 'permission_error', 403);
  }

  if (err.status === 429) {
    return new BridgeError('Rate limit exceeded', 'rate_limit_error', 429);
  }

  if (err.status === 500) {
    return new BridgeError('Internal server error', 'internal_error', 500);
  }

  return new BridgeError(
    error instanceof Error ? error.message : 'Unknown error',
    'internal_error',
    500
  );
}

interface AnthropicErrorData {
  error?: {
    message?: string;
    param?: string;
    type?: string;
  };
}

interface AnthropicError {
  response?: {
    status?: number;
    data?: AnthropicErrorData;
  };
  status?: number;
  error?: AnthropicErrorData;
}

export function mapAnthropicError(error: unknown): BridgeError {
  if (error instanceof BridgeError) {
    return error;
  }

  const err = error as AnthropicError;

  const status = err.response?.status ?? err.status;
  const data = err.response?.data ?? err.error;

  if (status === 400) {
    return new BridgeError(
      data?.error?.message ?? 'Invalid request',
      'invalid_request_error',
      400,
      data?.error?.param
    );
  }

  if (status === 401) {
    return new BridgeError('Invalid API key', 'authentication_error', 401);
  }

  if (status === 403) {
    return new BridgeError('Permission denied', 'permission_error', 403);
  }

  if (status === 429) {
    return new BridgeError('Rate limit exceeded', 'rate_limit_error', 429);
  }

  if (status === 529) {
    return new BridgeError('Service overloaded', 'overloaded_error', 529);
  }

  return new BridgeError(
    error instanceof Error ? error.message : 'Unknown error',
    'internal_error',
    500
  );
}
