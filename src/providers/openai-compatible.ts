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

export class OpenAICompatibleProvider implements Provider {
  readonly type = PROVIDER_TYPES.OPENAI_COMPATIBLE;
  readonly name: string;

  private readonly client: OpenAI;
  private readonly config: ProviderConfig;
  private readonly timeout: number;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.name = this.extractProviderName(config.baseUrl);
    this.timeout = config.timeout ?? 60000;

    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      maxRetries: config.maxRetries ?? 3,
      timeout: this.timeout,
      defaultHeaders: config.headers,
    });
  }

  private extractProviderName(baseUrl: string): string {
    try {
      const url = new URL(baseUrl);
      const hostParts = url.host.split('.');
      if (hostParts.length >= 2) {
        return hostParts[hostParts.length - 2];
      }
      return url.host;
    } catch {
      return 'openai-compatible';
    }
  }

  async listModels(): Promise<ProviderModelsResponse> {
    try {
      const response = await this.client.models.list();
      return {
        object: 'list',
        data: response.data.map((model) => ({
          id: model.id,
          name: model.id,
          owned_by: (model as unknown as { owner?: string }).owner,
        })),
      };
    } catch (error) {
      const classified = classifyError(error, this.name);
      throw new Error(`Failed to list models: ${classified.message}`);
    }
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
      } as OpenAI.ChatCompletionCreateParamsNonStreaming);

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
      } as OpenAI.ChatCompletionCreateParamsStreaming);

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

  async healthcheck(): Promise<boolean> {
    try {
      await this.client.models.list();
      return true;
    } catch {
      return false;
    }
  }

  async createEmbedding(input: string | string[], options?: EmbeddingOptions): Promise<unknown> {
    try {
      const response = await this.client.embeddings.create({
        model: options?.model ?? 'text-embedding-ada-002',
        input: input as string | string[],
        dimensions: options?.dimensions,
        encoding_format: options?.encodingFormat ?? 'float',
      });

      return response;
    } catch (error) {
      const classified = classifyError(error, this.name);
      throw new Error(`Embedding failed: ${classified.message}`);
    }
  }

  getClient(): OpenAI {
    return this.client;
  }

  getConfig(): ProviderConfig {
    return { ...this.config };
  }
}
