import Anthropic from '@anthropic-ai/sdk';
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

export class AnthropicProvider implements Provider {
  readonly type = PROVIDER_TYPES.ANTHROPIC;
  readonly name = 'anthropic';

  private readonly client: Anthropic;
  private readonly config: ProviderConfig;
  private readonly timeout: number;

  constructor(config: ProviderConfig) {
    this.config = config;
    this.timeout = config.timeout ?? 60000;

    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
      maxRetries: config.maxRetries ?? 3,
      timeout: this.timeout,
      defaultHeaders: config.headers,
    });
  }

  async listModels(): Promise<ProviderModelsResponse> {
    const knownModels = [
      'claude-3-5-sonnet-20240620',
      'claude-3-5-sonnet-20241022',
      'claude-3-opus-20240229',
      'claude-3-haiku-20240307',
      'claude-sonnet-4-20250514',
      'claude-sonnet-4-20251929',
      'claude-opus-4-5-20251101',
      'claude-haiku-4-20250711',
    ];

    return {
      object: 'list',
      data: knownModels.map((id) => ({
        id,
        name: id,
        owned_by: 'anthropic',
      })),
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
      const anthropicMessages = this.convertToAnthropicMessages(
        messages as Record<string, unknown>[]
      );

      const response = await this.client.messages.create({
        model,
        messages: anthropicMessages,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature,
        top_p: options?.topP,
        stop_sequences: options?.stop
          ? Array.isArray(options.stop)
            ? options.stop
            : [options.stop]
          : undefined,
        tools: options?.tools as Anthropic.Tool[] | undefined,
        stream: false,
      });

      return this.convertFromAnthropic(response);
    } catch (error) {
      const classified = classifyError(error, this.name);
      const err = new Error(classified.message) as Error & { providerError?: typeof classified };
      err.providerError = classified;
      throw err;
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
      const anthropicMessages = this.convertToAnthropicMessages(
        messages as Record<string, unknown>[]
      );

      const stream = await this.client.messages.stream({
        model,
        messages: anthropicMessages,
        max_tokens: options?.maxTokens ?? 4096,
        temperature: options?.temperature,
        top_p: options?.topP,
        stop_sequences: options?.stop
          ? Array.isArray(options.stop)
            ? options.stop
            : [options.stop]
          : undefined,
        tools: options?.tools as Anthropic.Tool[] | undefined,
        stream: true,
      });

      let contentBlockIndex = 0;
      let messageStartSent = false;

      for await (const event of stream) {
        const sseEvent = this.convertEventToSSE(event, contentBlockIndex, messageStartSent);
        if (sseEvent) {
          handler.onChunk(sseEvent);

          if (event.type === 'content_block_start') {
            contentBlockIndex = (event as { index: number }).index;
            messageStartSent = true;
          }
          if (event.type === 'message_start') {
            messageStartSent = true;
          }
        }
      }

      handler.onChunk('event: message_stop\ndata: {}\n\n');
      handler.onComplete();
    } catch (error) {
      const classified = classifyError(error, this.name);
      handler.onError(classified);
    }
  }

  async healthcheck(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      return true;
    } catch {
      return false;
    }
  }

  async createEmbedding(_input: string | string[], _options?: EmbeddingOptions): Promise<unknown> {
    throw new Error('Embeddings are not supported for Anthropic provider');
  }

  getClient(): Anthropic {
    return this.client;
  }

  getConfig(): ProviderConfig {
    return { ...this.config };
  }

  private convertToAnthropicMessages(
    messages: Record<string, unknown>[]
  ): Anthropic.MessageParam[] {
    return messages.map((msg) => {
      const role = msg.role as string;
      const content = msg.content;

      if (role === 'system') {
        return {
          role: 'user' as const,
          content: typeof content === 'string' ? content : ' ',
        };
      }

      return {
        role: role as 'user' | 'assistant',
        content: typeof content === 'string' ? content : ' ',
      };
    });
  }

  private convertFromAnthropic(response: Anthropic.Message): unknown {
    return {
      id: response.id,
      type: 'message',
      role: 'assistant',
      content: response.content.map((block) => {
        if ('text' in block) {
          return { type: 'text', text: block.text };
        }
        if ('type' in block && block.type === 'tool_use') {
          return {
            type: 'tool_use',
            id: block.id,
            name: block.name,
            input: block.input,
          };
        }
        return { type: 'text', text: '' };
      }),
      model: response.model,
      stop_reason: response.stop_reason,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    };
  }

  private convertEventToSSE(
    event: Anthropic.MessageStreamEvent,
    _contentBlockIndex: number,
    _messageStartSent: boolean
  ): string | null {
    switch (event.type) {
      case 'message_start':
        return `event: message_start\ndata: ${JSON.stringify({
          type: 'message_start',
          message: {
            id: (event as { message: { id: string } }).message.id,
            type: 'message',
            role: 'assistant',
            content: [],
            model: (event as { message: { model: string } }).message.model,
            usage: { input_tokens: 0, output_tokens: 0 },
          },
        })}\n\n`;

      case 'content_block_start':
        return `event: content_block_start\ndata: ${JSON.stringify({
          type: 'content_block_start',
          index: (event as { index: number }).index,
          content_block: { type: 'text' },
        })}\n\n`;

      case 'content_block_delta': {
        const deltaEvent = event as {
          type: 'content_block_delta';
          index: number;
          delta: { type: string; text?: string; partial_json?: string };
        };
        if (deltaEvent.delta.type === 'text_delta') {
          return `event: content_block_delta\ndata: ${JSON.stringify({
            type: 'content_block_delta',
            index: deltaEvent.index,
            delta: { type: 'text_delta', text: deltaEvent.delta.text },
          })}\n\n`;
        }
        if (deltaEvent.delta.type === 'input_json_delta') {
          return `event: content_block_delta\ndata: ${JSON.stringify({
            type: 'content_block_delta',
            index: deltaEvent.index,
            delta: { type: 'input_json_delta', partial_json: deltaEvent.delta.partial_json },
          })}\n\n`;
        }
        return null;
      }

      case 'content_block_stop':
        return `event: content_block_stop\ndata: ${JSON.stringify({
          type: 'content_block_stop',
          index: (event as { index: number }).index,
        })}\n\n`;

      case 'message_delta': {
        const deltaEvent = event as {
          type: 'message_delta';
          delta: { stop_reason?: string };
          usage: { output_tokens: number };
        };
        return `event: message_delta\ndata: ${JSON.stringify({
          type: 'message_delta',
          delta: { stop_reason: deltaEvent.delta.stop_reason },
          usage: { output_tokens: deltaEvent.usage.output_tokens },
        })}\n\n`;
      }

      case 'message_stop':
        return null;

      default:
        return null;
    }
  }
}
