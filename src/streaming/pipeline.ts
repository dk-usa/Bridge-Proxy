import type { Writable } from 'stream';
import { createSSEWriter, type SSEWriter } from './sse-writer.js';
import { createEventTranslator, type EventTranslator } from './event-translator.js';
import { createStreamParser, type StreamParser } from './stream-parser.js';

export interface StreamingPipelineOptions {
  model: string;
  messageId: string;
  includeUsage?: boolean;
}

export interface StreamingPipelineCallbacks {
  onChunk?: (anthropicEvent: string) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
}

export class StreamingPipeline {
  private translator: EventTranslator;
  private parser: StreamParser;
  private writer: SSEWriter;
  private callbacks: StreamingPipelineCallbacks;
  private isActive: boolean = false;
  private hasCompleted: boolean = false;
  private hasErrored: boolean = false;
  private static readonly MAX_BUFFER_SIZE = 1024 * 1024; // 1MB limit

  constructor(options: StreamingPipelineOptions, callbacks: StreamingPipelineCallbacks = {}) {
    this.writer = createSSEWriter();
    this.translator = createEventTranslator({
      model: options.model,
      messageId: options.messageId,
      includeUsage: options.includeUsage,
    });
    this.parser = createStreamParser();
    this.callbacks = callbacks;
  }

  processChunk(rawChunk: string): void {
    if (!this.isActive || this.hasCompleted || this.hasErrored) {
      return;
    }

    // Check buffer size to prevent memory leak
    if (
      this.parser.getRemainingBuffer().length + rawChunk.length >
      StreamingPipeline.MAX_BUFFER_SIZE
    ) {
      this.handleError(new Error('Stream buffer overflow - chunk too large'));
      return;
    }

    try {
      const parsedChunks = this.parser.parse(rawChunk);

      for (const parsed of parsedChunks) {
        if (parsed.data === '[DONE]') {
          this.finalize();
          continue;
        }

        const anthropicEvents = this.translator.translateChunk(parsed.data);

        if (anthropicEvents && this.callbacks.onChunk) {
          this.callbacks.onChunk(anthropicEvents);
        }
      }
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  processLine(line: string): void {
    if (!this.isActive || this.hasCompleted || this.hasErrored) {
      return;
    }

    // Check buffer size to prevent memory leak
    if (this.parser.getRemainingBuffer().length + line.length > StreamingPipeline.MAX_BUFFER_SIZE) {
      this.handleError(new Error('Stream buffer overflow - line too large'));
      return;
    }

    try {
      if (!line.trim() || line.startsWith(':')) {
        return;
      }

      if (line.startsWith('data: ')) {
        const data = line.slice(6).trim();

        if (data === '[DONE]') {
          this.finalize();
          return;
        }

        const anthropicEvents = this.translator.translateChunk(data);

        if (anthropicEvents && this.callbacks.onChunk) {
          this.callbacks.onChunk(anthropicEvents);
        }
      }
    } catch (error) {
      this.handleError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private handleError(error: Error): void {
    if (this.hasErrored || this.hasCompleted) {
      return;
    }

    this.hasErrored = true;
    this.isActive = false;

    if (this.callbacks.onError) {
      this.callbacks.onError(error);
    }

    // Ensure stream is properly terminated
    this.terminateStream();
  }

  private terminateStream(): void {
    try {
      const finalEvents = this.translator.finalize();
      if (finalEvents && this.callbacks.onChunk) {
        this.callbacks.onChunk(finalEvents);
      }
    } finally {
      this.hasCompleted = true;
      if (this.callbacks.onComplete) {
        this.callbacks.onComplete();
      }
    }
  }

  finalize(): void {
    if (this.hasCompleted || this.hasErrored) {
      return;
    }

    try {
      const finalEvents = this.translator.finalize();
      if (finalEvents && this.callbacks.onChunk) {
        this.callbacks.onChunk(finalEvents);
      }
    } finally {
      this.hasCompleted = true;
      this.isActive = false;
      if (this.callbacks.onComplete) {
        this.callbacks.onComplete();
      }
    }
  }

  start(): void {
    this.isActive = true;
    this.hasCompleted = false;
  }

  stop(): void {
    this.isActive = false;
    if (!this.hasCompleted) {
      this.finalize();
    }
  }

  reset(): void {
    this.parser.clear();
    this.translator.reset();
    this.isActive = false;
    this.hasCompleted = false;
    this.hasErrored = false;
  }

  writeMessageStart(): string {
    return this.writer.writeMessageStart({
      id: this.translator['messageId'],
      type: 'message',
      role: 'assistant',
      content: [],
      model: this.translator['model'],
      usage: { input_tokens: 0, output_tokens: 0 },
    });
  }

  writeError(errorType: string, message: string): string {
    return this.writer.writeError(errorType, message);
  }
}

export function createStreamingPipeline(
  options: StreamingPipelineOptions,
  callbacks?: StreamingPipelineCallbacks
): StreamingPipeline {
  return new StreamingPipeline(options, callbacks);
}

export function createStreamingHandler(
  options: StreamingPipelineOptions,
  outputStream: Writable
): {
  processChunk: (chunk: string) => void;
  onError: (error: Error) => void;
  onComplete: () => void;
} {
  const pipeline = createStreamingPipeline(options, {
    onChunk: (anthropicChunk) => {
      outputStream.write(anthropicChunk);
    },
    onError: (error) => {
      outputStream.write(
        `event: error\ndata: ${JSON.stringify({
          type: 'error',
          error: {
            type: 'internal_error',
            message: error.message,
          },
        })}\n\n`
      );
      outputStream.end();
    },
    onComplete: () => {
      outputStream.end();
    },
  });

  pipeline.start();

  return {
    processChunk: (chunk: string) => pipeline.processChunk(chunk),
    onError: (error: Error) => pipeline.writeError('internal_error', error.message),
    onComplete: () => pipeline.finalize(),
  };
}
