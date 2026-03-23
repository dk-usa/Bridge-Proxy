import type { OpenAIChatCompletionChunk } from '../schemas/openai.js';
import { ANTHROPIC_CONTENT_BLOCK_TYPES, ANTHROPIC_STOP_REASONS } from '../schemas/anthropic.js';
import { createSSEWriter, type SSEWriter } from './sse-writer.js';

export interface StreamParserOptions {
  model: string;
  messageId: string;
  includeUsage?: boolean;
}

interface ToolCallBuffer {
  id: string;
  name: string | null;
  arguments: string;
  type: 'text' | 'tool_use';
}

export class EventTranslator {
  private writer: SSEWriter;
  private model: string;
  private messageId: string;
  private includeUsage: boolean;
  private contentBlockIndex: number = 0;
  private toolCallBuffers: Map<string, ToolCallBuffer> = new Map();
  private hasEmittedMessageStart: boolean = false;
  private hasEmittedFirstContent: boolean = false;
  private currentToolCallIndex: number = 0;
  private currentToolCallId: string | null = null;
  private isInToolCall: boolean = false;

  constructor(writer: SSEWriter, options: StreamParserOptions) {
    this.writer = writer;
    this.model = options.model;
    this.messageId = options.messageId;
    this.includeUsage = options.includeUsage ?? true;
  }

  translateChunk(rawChunk: string): string {
    const parsed = this.parseChunk(rawChunk);
    if (!parsed) {
      return '';
    }

    return this.processChunk(parsed);
  }

  private parseChunk(rawChunk: string): OpenAIChatCompletionChunk | null {
    if (!rawChunk.trim() || rawChunk.startsWith(':')) {
      return null;
    }

    if (rawChunk.startsWith('data: ')) {
      const data = rawChunk.slice(6).trim();
      if (data === '[DONE]') {
        return null;
      }

      try {
        return JSON.parse(data) as OpenAIChatCompletionChunk;
      } catch {
        return null;
      }
    }

    try {
      return JSON.parse(rawChunk) as OpenAIChatCompletionChunk;
    } catch {
      return null;
    }
  }

  private processChunk(chunk: OpenAIChatCompletionChunk): string {
    const events: string[] = [];
    const choice = chunk.choices?.[0];

    if (!this.hasEmittedMessageStart) {
      events.push(
        this.writer.writeMessageStart({
          id: chunk.id ?? this.messageId,
          type: 'message',
          role: 'assistant',
          content: [],
          model: chunk.model ?? this.model,
          usage: {
            input_tokens: 0,
            output_tokens: 0,
          },
        })
      );
      this.hasEmittedMessageStart = true;
    }

    if (!choice?.delta) {
      if (choice?.finish_reason) {
        events.push(this.handleFinishReason(chunk, choice.finish_reason));
      }
      return events.join('');
    }

    const delta = choice.delta;

    if (delta.content !== undefined && delta.content !== '') {
      events.push(this.handleTextContent(choice.index, delta.content));
    }

    if (delta.tool_calls && delta.tool_calls.length > 0) {
      for (const tc of delta.tool_calls) {
        events.push(this.handleToolCall(choice.index, tc));
      }
    }

    if (choice?.finish_reason) {
      events.push(this.handleFinishReason(chunk, choice.finish_reason));
    }

    return events.join('');
  }

  private handleTextContent(index: number, content: string): string {
    if (!this.hasEmittedFirstContent) {
      this.hasEmittedFirstContent = true;
      return (
        this.writer.writeContentBlockStart(index, ANTHROPIC_CONTENT_BLOCK_TYPES.TEXT) +
        this.writer.writeTextDelta(index, content)
      );
    }

    return this.writer.writeTextDelta(index, content);
  }

  private handleToolCall(
    _index: number,
    toolCall: {
      id?: string;
      function?: {
        name?: string;
        arguments?: string;
      };
    }
  ): string {
    const events: string[] = [];
    const toolCallId = toolCall.id;

    if (!toolCallId) {
      if (toolCall.function?.arguments) {
        const buffer = this.toolCallBuffers.get(this.currentToolCallId ?? '');
        if (buffer) {
          buffer.arguments += toolCall.function.arguments;
          events.push(
            this.writer.writeInputJsonDelta(
              buffer.type === 'tool_use' ? this.currentToolCallIndex : 0,
              toolCall.function.arguments
            )
          );
        }
      }
      return events.join('');
    }

    const existingBuffer = this.toolCallBuffers.get(toolCallId);

    if (!existingBuffer) {
      const newBuffer: ToolCallBuffer = {
        id: toolCallId,
        name: toolCall.function?.name ?? null,
        arguments: toolCall.function?.arguments ?? '',
        type: 'tool_use',
      };
      this.toolCallBuffers.set(toolCallId, newBuffer);
      this.currentToolCallId = toolCallId;
      this.currentToolCallIndex = this.toolCallBuffers.size - 1;
      this.isInToolCall = true;

      events.push(
        this.writer.writeContentBlockStart(
          this.currentToolCallIndex,
          ANTHROPIC_CONTENT_BLOCK_TYPES.TOOL_USE
        )
      );

      if (newBuffer.name) {
        events.push(
          this.writer.writeInputJsonDelta(
            this.currentToolCallIndex,
            JSON.stringify({ name: newBuffer.name })
          )
        );
      }

      if (newBuffer.arguments) {
        events.push(
          this.writer.writeInputJsonDelta(this.currentToolCallIndex, newBuffer.arguments)
        );
      }
    } else {
      if (toolCall.function?.name && !existingBuffer.name) {
        existingBuffer.name = toolCall.function.name;
        events.push(
          this.writer.writeInputJsonDelta(
            this.currentToolCallIndex,
            JSON.stringify({ name: toolCall.function.name })
          )
        );
      }

      if (toolCall.function?.arguments) {
        existingBuffer.arguments += toolCall.function.arguments;
        events.push(
          this.writer.writeInputJsonDelta(this.currentToolCallIndex, toolCall.function.arguments)
        );
      }
    }

    return events.join('');
  }

  private handleFinishReason(
    chunk: OpenAIChatCompletionChunk,
    finishReason: string | null
  ): string {
    const events: string[] = [];

    const stopReason = this.mapFinishReason(finishReason);

    if (this.isInToolCall || this.toolCallBuffers.size > 0) {
      for (let i = 0; i < this.toolCallBuffers.size; i++) {
        events.push(this.writer.writeContentBlockStop(i));
      }
      this.isInToolCall = false;
    } else if (this.hasEmittedFirstContent) {
      events.push(this.writer.writeContentBlockStop(this.contentBlockIndex));
    }

    const usage = chunk.usage?.completion_tokens;
    if (this.includeUsage && usage !== undefined) {
      events.push(
        this.writer.writeMessageDelta(stopReason, {
          output_tokens: usage,
        })
      );
    } else {
      events.push(this.writer.writeMessageDelta(stopReason));
    }

    return events.join('');
  }

  private mapFinishReason(reason: string | null): string {
    switch (reason) {
      case 'stop':
        return ANTHROPIC_STOP_REASONS.END_TURN;
      case 'length':
        return ANTHROPIC_STOP_REASONS.MAX_TOKENS;
      case 'tool_calls':
        return ANTHROPIC_STOP_REASONS.TOOL_USE;
      default:
        return ANTHROPIC_STOP_REASONS.END_TURN;
    }
  }

  finalize(): string {
    const events: string[] = [];

    if (this.isInToolCall || this.toolCallBuffers.size > 0) {
      for (let i = 0; i < this.toolCallBuffers.size; i++) {
        events.push(this.writer.writeContentBlockStop(i));
      }
    } else if (this.hasEmittedFirstContent && this.hasEmittedMessageStart) {
      events.push(this.writer.writeContentBlockStop(0));
    }

    events.push(this.writer.writeMessageStop());

    return events.join('');
  }

  reset(): void {
    this.contentBlockIndex = 0;
    this.toolCallBuffers.clear();
    this.hasEmittedMessageStart = false;
    this.hasEmittedFirstContent = false;
    this.currentToolCallIndex = 0;
    this.currentToolCallId = null;
    this.isInToolCall = false;
  }
}

export function createEventTranslator(options: StreamParserOptions): EventTranslator {
  const writer = createSSEWriter();
  return new EventTranslator(writer, options);
}

export function translateOpenAIStreamToAnthropic(
  rawChunk: string,
  translator: EventTranslator
): string {
  return translator.translateChunk(rawChunk);
}
