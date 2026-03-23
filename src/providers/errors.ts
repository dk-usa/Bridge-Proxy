import type { ProviderError } from './base.js';
import { PROVIDER_ERROR_TYPES } from './base.js';

export interface ErrorClassificationConfig {
  provider: string;
  statusCode?: number;
  code?: string;
  message?: string;
  type?: string;
}

interface OpenAIErrorResponse {
  status?: number;
  data?: {
    error?: {
      type?: string;
      message?: string;
      param?: string;
      code?: string;
    };
  };
}

interface AnthropicErrorResponse {
  response?: {
    status?: number;
    data?: {
      error?: {
        type?: string;
        message?: string;
        param?: string;
      };
    };
  };
  status?: number;
  error?: {
    error?: {
      type?: string;
      message?: string;
    };
  };
}

interface TimeoutError {
  message?: string;
  code?: string;
}

interface NetworkError {
  code?: string;
}

export function classifyError(error: unknown, provider: string): ProviderError {
  const baseError: ProviderError = {
    type: PROVIDER_ERROR_TYPES.UNKNOWN,
    message: 'An unknown error occurred',
    statusCode: null,
    param: null,
    code: null,
    isRetryable: false,
    provider,
  };

  if (error instanceof Error) {
    baseError.message = error.message;
  }

  if (isOpenAIError(error)) {
    return classifyOpenAIError(error, provider, baseError);
  }

  if (isAnthropicError(error)) {
    return classifyAnthropicError(error, provider, baseError);
  }

  if (isTimeoutError(error)) {
    return {
      ...baseError,
      type: PROVIDER_ERROR_TYPES.TIMEOUT,
      message: error instanceof Error ? error.message : 'Request timeout',
      isRetryable: true,
    };
  }

  if (isNetworkError(error)) {
    return {
      ...baseError,
      type: PROVIDER_ERROR_TYPES.NETWORK,
      message: error instanceof Error ? error.message : 'Network error',
      isRetryable: true,
    };
  }

  return baseError;
}

function isOpenAIError(error: unknown): error is OpenAIErrorResponse {
  const err = error as OpenAIErrorResponse | null;
  if (!err) return false;
  return typeof err.status === 'number' || err.data?.error !== undefined;
}

function isAnthropicError(error: unknown): error is AnthropicErrorResponse {
  const err = error as AnthropicErrorResponse | null;
  if (!err) return false;
  const status = err.response?.status ?? err.status;
  return typeof status === 'number' && status >= 400;
}

function isTimeoutError(error: unknown): error is TimeoutError {
  const err = error as TimeoutError | null;
  if (!err) return false;
  return (
    err.code === 'ETIMEDOUT' ||
    err.code === 'ECONNABORTED' ||
    (err.message?.toLowerCase().includes('timeout') ?? false)
  );
}

function isNetworkError(error: unknown): error is NetworkError {
  const err = error as NetworkError | null;
  if (!err) return false;
  return (
    err.code === 'ENOTFOUND' ||
    err.code === 'ECONNREFUSED' ||
    err.code === 'ECONNRESET' ||
    err.code === 'NETWORK_ERROR'
  );
}

function classifyOpenAIError(
  error: OpenAIErrorResponse,
  _provider: string,
  base: ProviderError
): ProviderError {
  const status = error.status ?? 0;
  const data = error.data;

  const errorMessage = data?.error?.message;
  const errorParam = data?.error?.param ?? null;
  const errorCode = data?.error?.code ?? null;

  switch (status) {
    case 400:
      return {
        ...base,
        type: PROVIDER_ERROR_TYPES.INVALID_REQUEST,
        message: errorMessage ?? 'Invalid request',
        statusCode: status,
        param: errorParam,
        code: errorCode,
        isRetryable: false,
      };

    case 401:
      return {
        ...base,
        type: PROVIDER_ERROR_TYPES.AUTHENTICATION,
        message: errorMessage ?? 'Invalid or missing API key',
        statusCode: status,
        isRetryable: false,
      };

    case 403:
      return {
        ...base,
        type: PROVIDER_ERROR_TYPES.PERMISSION,
        message: errorMessage ?? 'Permission denied',
        statusCode: status,
        isRetryable: false,
      };

    case 404:
      return {
        ...base,
        type: PROVIDER_ERROR_TYPES.NOT_FOUND,
        message: errorMessage ?? 'Resource not found',
        statusCode: status,
        isRetryable: false,
      };

    case 429:
      return {
        ...base,
        type: PROVIDER_ERROR_TYPES.RATE_LIMIT,
        message: errorMessage ?? 'Rate limit exceeded',
        statusCode: status,
        isRetryable: true,
      };

    case 500:
    case 502:
    case 503:
      return {
        ...base,
        type: PROVIDER_ERROR_TYPES.INTERNAL,
        message: errorMessage ?? 'Internal server error',
        statusCode: status,
        isRetryable: true,
      };

    default:
      return {
        ...base,
        statusCode: status,
        message: errorMessage ?? base.message,
      };
  }
}

function classifyAnthropicError(
  error: AnthropicErrorResponse,
  _provider: string,
  base: ProviderError
): ProviderError {
  const status = error.response?.status ?? error.status ?? 0;
  const data = error.response?.data ?? error.error;

  const errorMessage = data?.error?.message;
  const errorParam = (data?.error as { param?: string })?.param ?? null;
  const errorType = data?.error?.type ?? null;

  switch (status) {
    case 400:
      return {
        ...base,
        type: PROVIDER_ERROR_TYPES.INVALID_REQUEST,
        message: errorMessage ?? 'Invalid request',
        statusCode: status,
        param: errorParam,
        code: errorType,
        isRetryable: false,
      };

    case 401:
      return {
        ...base,
        type: PROVIDER_ERROR_TYPES.AUTHENTICATION,
        message: errorMessage ?? 'Invalid or missing API key',
        statusCode: status,
        isRetryable: false,
      };

    case 403:
      return {
        ...base,
        type: PROVIDER_ERROR_TYPES.PERMISSION,
        message: errorMessage ?? 'Permission denied',
        statusCode: status,
        isRetryable: false,
      };

    case 429:
      return {
        ...base,
        type: PROVIDER_ERROR_TYPES.RATE_LIMIT,
        message: errorMessage ?? 'Rate limit exceeded',
        statusCode: status,
        isRetryable: true,
      };

    case 529:
      return {
        ...base,
        type: PROVIDER_ERROR_TYPES.OVERLOADED,
        message: errorMessage ?? 'Service overloaded',
        statusCode: status,
        isRetryable: true,
      };

    default:
      return {
        ...base,
        statusCode: status,
        message: errorMessage ?? base.message,
      };
  }
}

export function isRetryableError(error: ProviderError): boolean {
  return error.isRetryable;
}

export function getErrorMessage(error: ProviderError): string {
  return error.message;
}

export function getErrorType(error: ProviderError): string {
  return error.type;
}
