import { ANTHROPIC_STREAM_EVENT_TYPES } from '../schemas/anthropic.js';

export interface SSEWriterOptions {
  prefix?: string;
}

interface MessageStartEvent {
  type: 'message_start';
  message: {
    id: string;
    type: 'message';
    role: 'assistant';
    content: unknown[];
    model: string;
    usage: { input_tokens: number; output_tokens: number };
  };
}

interface ContentBlockStartEvent {
  type: 'content_block_start';
  index: number;
  content_block: { type: string };
}

interface TextDeltaEvent {
  type: 'text_delta';
  text: string;
}

interface InputJsonDeltaEvent {
  type: 'input_json_delta';
  partial_json: string;
}

type ContentBlockDeltaEvent = {
  type: 'content_block_delta';
  index: number;
  delta: TextDeltaEvent | InputJsonDeltaEvent;
};

interface ContentBlockStopEvent {
  type: 'content_block_stop';
  index: number;
}

interface MessageDeltaEvent {
  type: 'message_delta';
  delta: {
    stop_reason?: string;
    usage?: { output_tokens: number };
  };
  usage?: { output_tokens: number };
}

interface MessageStopEvent {
  type: 'message_stop';
}

export class SSEWriter {
  private prefix: string;

  constructor(options: SSEWriterOptions = {}) {
    this.prefix = options.prefix ?? '';
  }

  writeMessageStart(message: MessageStartEvent['message']): string {
    const event: MessageStartEvent = {
      type: ANTHROPIC_STREAM_EVENT_TYPES.MESSAGE_START,
      message,
    };
    return `${this.prefix}event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  }

  writeContentBlockStart(index: number, contentBlockType: string): string {
    const event: ContentBlockStartEvent = {
      type: ANTHROPIC_STREAM_EVENT_TYPES.CONTENT_BLOCK_START,
      index,
      content_block: { type: contentBlockType },
    };
    return `${this.prefix}event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  }

  writeContentBlockDelta(index: number, delta: TextDeltaEvent | InputJsonDeltaEvent): string {
    const event: ContentBlockDeltaEvent = {
      type: ANTHROPIC_STREAM_EVENT_TYPES.CONTENT_BLOCK_DELTA,
      index,
      delta,
    };
    return `${this.prefix}event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  }

  writeTextDelta(index: number, text: string): string {
    return this.writeContentBlockDelta(index, {
      type: 'text_delta',
      text,
    });
  }

  writeInputJsonDelta(index: number, partialJson: string): string {
    return this.writeContentBlockDelta(index, {
      type: 'input_json_delta',
      partial_json: partialJson,
    });
  }

  writeContentBlockStop(index: number): string {
    const event: ContentBlockStopEvent = {
      type: ANTHROPIC_STREAM_EVENT_TYPES.CONTENT_BLOCK_STOP,
      index,
    };
    return `${this.prefix}event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  }

  writeMessageDelta(stopReason?: string, usage?: { output_tokens: number }): string {
    const event: MessageDeltaEvent = {
      type: ANTHROPIC_STREAM_EVENT_TYPES.MESSAGE_DELTA,
      delta: {
        stop_reason: stopReason,
        usage,
      },
      usage,
    };
    return `${this.prefix}event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  }

  writeMessageStop(): string {
    const event: MessageStopEvent = {
      type: ANTHROPIC_STREAM_EVENT_TYPES.MESSAGE_STOP,
    };
    return `${this.prefix}event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
  }

  writeError(errorType: string, message: string): string {
    return `${this.prefix}event: error\ndata: ${JSON.stringify({
      type: 'error',
      error: {
        type: errorType,
        message,
      },
    })}\n\n`;
  }
}

export function createSSEWriter(options?: SSEWriterOptions): SSEWriter {
  return new SSEWriter(options);
}
