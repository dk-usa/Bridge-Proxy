import OpenAI from 'openai';
import type {
  Provider,
  ProviderConfig,
  ProviderMessageOptions,
  StreamHandler,
  ProviderModelsResponse,
  EmbeddingOptions,
} from './base.js';
import { PROVIDER_TYPES } from './base.js';
import { classifyError } from './errors.js';

export class GoogleProvider implements Provider {
  readonly type = PROVIDER_TYPES.GOOGLE;
  readonly name = 'google';

  private readonly client: OpenAI;
  private readonly config: ProviderConfig;
  private readonly timeout: number;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.timeout = config.timeout ?? 60000;

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://generativelanguage.googleapis.com/v1beta',
      maxRetries: config.maxRetries ?? 3,
      timeout: this.timeout,
      defaultHeaders: config.headers,
    });
  }

  async listModels(): Promise<ProviderModelsResponse> {
    return {
      object: 'list',
      data: [
        { id: 'gemini-2.0-flash-exp', name: 'gemini-2.0-flash-exp', owned_by: 'google' },
        { id: 'gemini-2.0-flash', name: 'gemini-2.0-flash', owned_by: 'google' },
        { id: 'gemini-1.5-pro', name: 'gemini-1.5-pro', owned_by: 'google' },
        { id: 'gemini-1.5-flash', name: 'gemini-1.5-flash', owned_by: 'google' },
        { id: 'gemini-1.5-flash-8b', name: 'gemini-1.5-flash-8b', owned_by: 'google' },
        { id: 'gemini-pro', name: 'gemini-pro', owned_by: 'google' },
        { id: 'gemini-pro-vision', name: 'gemini-pro-vision', owned_by: 'google' },
      ],
    };
  }

  async createMessageNonStreaming(
    messages: unknown[],
    options?: ProviderMessageOptions
  ): Promise<unknown> {
    const model = options?.model ?? this.config.defaultModel;
    if (!model) {
      throw new Error('No model specified and no default model configured');
    }

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: messages as OpenAI.ChatCompletionMessageParam[],
        temperature: options?.temperature,
        top_p: options?.topP,
        max_tokens: options?.maxTokens,
        stop: options?.stop,
        tools: options?.tools as OpenAI.ChatCompletionTool[] | undefined,
        tool_choice: options?.toolChoice as OpenAI.ChatCompletionToolChoiceOption | undefined,
        stream: false,
      });

      return response;
    } catch (error) {
      const classified = classifyError(error, this.name);
      const error_ = new Error(classified.message) as Error & { providerError?: typeof classified };
      error_.providerError = classified;
      throw error_;
    }
  }

  async createMessageStreaming(
    messages: unknown[],
    options: ProviderMessageOptions,
    handler: StreamHandler
  ): Promise<void> {
    const model = options?.model ?? this.config.defaultModel;
    if (!model) {
      throw new Error('No model specified and no default model configured');
    }

    try {
      const response = await this.client.chat.completions.create({
        model,
        messages: messages as OpenAI.ChatCompletionMessageParam[],
        temperature: options?.temperature,
        top_p: options?.topP,
        max_tokens: options?.maxTokens,
        stop: options?.stop,
        tools: options?.tools as OpenAI.ChatCompletionTool[] | undefined,
        tool_choice: options?.toolChoice as OpenAI.ChatCompletionToolChoiceOption | undefined,
        stream: true,
      });

      const iterator = response[Symbol.asyncIterator]();
      let result = await iterator.next();

      while (!result.done) {
        const chunk = result.value;
        const data = `data: ${JSON.stringify(chunk)}\n\n`;
        handler.onChunk(data);
        result = await iterator.next();
      }

      handler.onChunk('data: [DONE]\n\n');
      handler.onComplete();
    } catch (error) {
      const classified = classifyError(error, this.name);
      handler.onError(classified);
    }
  }

  async createEmbedding(input: string | string[], options?: EmbeddingOptions): Promise<unknown> {
    try {
      const model = options?.model ?? 'text-embedding-004';
      const response = await this.client.embeddings.create({
        model,
        input: input as string | string[],
        dimensions: options?.dimensions,
        encoding_format: (options?.encodingFormat ?? 'float') as 'float' | 'base64',
      });

      return response;
    } catch (error) {
      const classified = classifyError(error, this.name);
      throw new Error(`Embedding failed: ${classified.message}`);
    }
  }

  async healthcheck(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  getClient(): OpenAI {
    return this.client;
  }

  getConfig(): ProviderConfig {
    return { ...this.config };
  }
}
