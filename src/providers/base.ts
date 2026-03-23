import { z } from 'zod';

export const PROVIDER_TYPES = {
  OPENAI_COMPATIBLE: 'openai-compatible',
  ANTHROPIC: 'anthropic',
  AZURE: 'azure',
  GOOGLE: 'google',
  COHERE: 'cohere',
  MISTRAL: 'mistral',
} as const;

export type ProviderType = (typeof PROVIDER_TYPES)[keyof typeof PROVIDER_TYPES];

export const PROVIDER_ERROR_TYPES = {
  INVALID_REQUEST: 'invalid_request_error',
  AUTHENTICATION: 'authentication_error',
  PERMISSION: 'permission_error',
  NOT_FOUND: 'not_found_error',
  RATE_LIMIT: 'rate_limit_error',
  OVERLOADED: 'overloaded_error',
  INTERNAL: 'internal_error',
  TIMEOUT: 'timeout_error',
  NETWORK: 'network_error',
  UNKNOWN: 'unknown_error',
} as const;

export type ProviderErrorType = (typeof PROVIDER_ERROR_TYPES)[keyof typeof PROVIDER_ERROR_TYPES];

export const ProviderErrorSchema = z.object({
  type: z.string(),
  message: z.string(),
  statusCode: z.number().int().nullable(),
  param: z.string().nullable(),
  code: z.string().nullable(),
  isRetryable: z.boolean(),
  provider: z.string(),
});

export type ProviderError = z.infer<typeof ProviderErrorSchema>;

export const ProviderModelSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  owned_by: z.string().optional(),
  permission: z.unknown().optional(),
  root: z.string().optional(),
  parent: z.string().optional(),
});

export type ProviderModel = z.infer<typeof ProviderModelSchema>;

export const ProviderModelsResponseSchema = z.object({
  object: z.literal('list'),
  data: z.array(ProviderModelSchema),
});

export type ProviderModelsResponse = z.infer<typeof ProviderModelsResponseSchema>;

export interface ProviderConfig {
  baseUrl: string;
  apiKey: string;
  defaultModel?: string;
  timeout?: number;
  maxRetries?: number;
  headers?: Record<string, string>;
}

export interface ProviderMessageOptions {
  model?: string;
  temperature?: number;
  topP?: number;
  maxTokens?: number;
  stop?: string | string[];
  tools?: unknown[];
  toolChoice?: unknown;
  stream?: boolean;
  streamOptions?: {
    includeUsage?: boolean;
  };
  metadata?: Record<string, unknown>;
}

export interface StreamHandler {
  onChunk: (chunk: string) => void;
  onError: (error: ProviderError) => void;
  onComplete: () => void;
}

export interface StreamingCallbacks {
  onChunk: (chunk: string) => void;
  onError: (error: Error) => void;
  onComplete: () => void;
}

export interface Provider {
  readonly type: ProviderType;
  readonly name: string;

  listModels(): Promise<ProviderModelsResponse>;
  createMessageNonStreaming(
    messages: unknown[],
    options?: ProviderMessageOptions
  ): Promise<unknown>;
  createMessageStreaming(
    messages: unknown[],
    options: ProviderMessageOptions,
    handler: StreamHandler
  ): Promise<void>;
  createEmbedding(input: string | string[], options?: EmbeddingOptions): Promise<unknown>;
  healthcheck(): Promise<boolean>;
}

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
  encodingFormat?: 'float' | 'base64';
}

export interface EmbeddingResponse {
  object: string;
  data: Array<{
    object: string;
    embedding: number[] | string;
    index: number;
  }>;
  model: string;
  usage?: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

export interface ProviderClass<T extends Provider = Provider> {
  new (config: ProviderConfig): T;
}
