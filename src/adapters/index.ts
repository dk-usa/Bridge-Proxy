import type { AnthropicMessageRequest, AnthropicMessageResponse } from '../schemas/anthropic.js';
import type { OpenAIChatCompletionRequest } from '../schemas/openai.js';
import { normalizeAnthropicRequest, denormalizeOpenAIResponse } from './request.js';
import { getConfig, getLogger } from '../config/index.js';
import { createProvider, type Provider, type ProviderMessageOptions } from '../providers/index.js';
import { PROVIDER_TYPES } from '../providers/base.js';
import { mapOpenAIError } from './error.js';
import { classifyError } from '../providers/errors.js';
import { createStreamingPipeline, type StreamingPipeline } from '../streaming/index.js';
import { generateId } from '../utils/id.js';

interface ProviderPair {
  primary: Provider;
  fallback: Provider | null;
}

let providers: ProviderPair | null = null;

let mockPrimaryProvider: Provider | null = null;
let mockFallbackProvider: Provider | null = null;

export function setMockProviders(primary: Provider | null, fallback: Provider | null = null): void {
  mockPrimaryProvider = primary;
  mockFallbackProvider = fallback;
}

export function clearMockProviders(): void {
  mockPrimaryProvider = null;
  mockFallbackProvider = null;
}

function initializeProviders(): ProviderPair {
  const config = getConfig();
  const logger = getLogger();

  if (mockPrimaryProvider) {
    return { primary: mockPrimaryProvider, fallback: mockFallbackProvider };
  }

  if (!config.providers.primary.apiKey) {
    throw new Error('Primary provider API key is required');
  }

  const primary = createProvider(
    config.providers.primary.type ?? PROVIDER_TYPES.OPENAI_COMPATIBLE,
    {
      baseUrl: config.providers.primary.baseUrl ?? 'https://api.openai.com/v1',
      apiKey: config.providers.primary.apiKey,
      defaultModel: config.providers.primary.model,
      timeout: config.providers.primary.timeout,
      maxRetries: config.providers.primary.maxRetries,
    }
  );

  let fallback: Provider | null = null;
  if (mockFallbackProvider) {
    fallback = mockFallbackProvider;
  } else if (config.providers.fallback?.apiKey) {
    fallback = createProvider(config.providers.fallback.type ?? PROVIDER_TYPES.ANTHROPIC, {
      baseUrl: config.providers.fallback.baseUrl ?? '',
      apiKey: config.providers.fallback.apiKey,
      defaultModel: config.providers.fallback.model,
      timeout: config.providers.fallback.timeout,
      maxRetries: config.providers.fallback.maxRetries,
    });
    logger.info('Fallback provider initialized');
  }

  logger.info({ primary: primary.name, fallback: fallback?.name }, 'Providers initialized');

  return { primary, fallback };
}

function getProviders(): ProviderPair {
  if (!providers) {
    providers = initializeProviders();
  }
  return providers;
}

export function getProviderPair(): ProviderPair {
  return getProviders();
}

export function resetProviders(): void {
  providers = null;
  clearMockProviders();
}

function convertToProviderOptions(openai: OpenAIChatCompletionRequest): ProviderMessageOptions {
  const options: ProviderMessageOptions = {
    model: openai.model,
    temperature: openai.temperature,
    topP: openai.top_p,
    maxTokens: openai.max_tokens ?? openai.max_completion_tokens,
    stop: openai.stop,
    tools: openai.tools as unknown[],
    toolChoice: openai.tool_choice,
    stream: openai.stream,
    streamOptions: openai.stream_options
      ? { includeUsage: openai.stream_options.include_usage }
      : undefined,
    metadata: openai.metadata,
  };
  return options;
}

export async function handleMessage(
  request: AnthropicMessageRequest,
  _reply?: unknown
): Promise<AnthropicMessageResponse> {
  const config = getConfig();
  const logger = getLogger();

  const normalized = normalizeAnthropicRequest(request, config.modelMapping);

  logger.debug(
    { model: request.model, mappedModel: normalized.openai.model },
    'Processing message'
  );

  try {
    const { primary, fallback } = getProviders();
    const options = convertToProviderOptions(normalized.openai);

    let response;
    try {
      response = await primary.createMessageNonStreaming(
        normalized.openai.messages as unknown[],
        options
      );
    } catch (primaryError) {
      logger.warn({ error: primaryError }, 'Primary provider failed, trying fallback');

      if (fallback) {
        response = await fallback.createMessageNonStreaming(
          normalized.openai.messages as unknown[],
          options
        );
      } else {
        throw primaryError;
      }
    }

    return denormalizeOpenAIResponse(
      response as Parameters<typeof denormalizeOpenAIResponse>[0],
      request.model
    );
  } catch (error) {
    logger.error({ error }, 'Failed to handle message');
    const providerError = classifyError(error, 'bridge');
    throw mapOpenAIError(providerError);
  }
}

export async function handleStreamingMessage(
  request: AnthropicMessageRequest,
  callbacks: {
    onChunk: (chunk: string) => void;
    onError: (error: Error) => void;
    onComplete: () => void;
  },
  messageId?: string
): Promise<void> {
  const config = getConfig();
  const logger = getLogger();

  const normalized = normalizeAnthropicRequest(request, config.modelMapping);

  const mappedModel = normalized.openai.model;
  const msgId = messageId ?? generateId('msg');

  logger.debug({ model: request.model, mappedModel }, 'Processing streaming message');

  const includeUsage = request.stream_options?.include_usage ?? true;

  let pipeline: StreamingPipeline | null = null;
  let pipelineStarted = false;

  const { primary, fallback } = getProviders();
  const options = convertToProviderOptions(normalized.openai);

  const getPipeline = (): StreamingPipeline => {
    if (!pipeline) {
      pipeline = createStreamingPipeline(
        {
          model: mappedModel,
          messageId: msgId,
          includeUsage,
        },
        {
          onChunk: (anthropicChunk) => {
            callbacks.onChunk(anthropicChunk);
          },
          onError: (error) => {
            logger.error({ error: error.message }, 'Streaming pipeline error');
            callbacks.onError(error);
          },
          onComplete: () => {
            callbacks.onComplete();
          },
        }
      );
    }
    return pipeline;
  };

  const streamWithProvider = async (provider: Provider): Promise<void> => {
    let streamEnded = false;

    const endStream = () => {
      if (streamEnded) return;
      streamEnded = true;
    };

    await provider.createMessageStreaming(
      normalized.openai.messages as unknown[],
      { ...options, stream: true },
      {
        onChunk: (chunk: string) => {
          if (!pipelineStarted) {
            getPipeline().start();
            pipelineStarted = true;
          }
          if (!streamEnded) {
            getPipeline().processChunk(chunk);
          }
        },
        onError: (error) => {
          endStream();
          logger.error({ error: error.message }, 'Provider streaming error');
          callbacks.onError(new Error(error.message));
        },
        onComplete: () => {
          if (!streamEnded) {
            endStream();
            if (pipeline) {
              pipeline.finalize();
            }
          }
        },
      }
    );
  };

  try {
    await streamWithProvider(primary);
  } catch (primaryError) {
    logger.warn({ error: primaryError }, 'Primary provider failed, trying fallback');

    if (fallback) {
      if (pipeline !== null) {
        (pipeline as StreamingPipeline).reset();
      }
      pipelineStarted = false;

      try {
        await streamWithProvider(fallback);
      } catch (fallbackError) {
        logger.error({ error: fallbackError }, 'Fallback provider also failed');
        callbacks.onError(
          fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError))
        );
      }
    } else {
      logger.error({ error: primaryError }, 'Primary provider failed with no fallback');
      callbacks.onError(
        primaryError instanceof Error ? primaryError : new Error(String(primaryError))
      );
    }
  }
}
