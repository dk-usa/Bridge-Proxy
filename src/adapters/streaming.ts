import type { FastifyReply } from 'fastify';
import type { AnthropicMessageRequest } from '../schemas/anthropic.js';
import type { StreamingCallbacks } from '../providers/base.js';

export interface StreamAdapter {
  toAnthropicSSE(chunk: string): string;
}

export class SSEStreamAdapter implements StreamAdapter {
  private toolCallBuffer: Map<string, string> = new Map();

  toAnthropicSSE(openaiChunk: string): string {
    try {
      const parsed = JSON.parse(openaiChunk);
      if (parsed.object !== 'chat.completion.chunk') {
        return '';
      }

      const choice = parsed.choices?.[0];
      if (!choice) return '';

      const events: string[] = [];

      if (choice.delta?.content !== undefined) {
        events.push(
          this.formatEvent('content_block_delta', {
            index: choice.index,
            delta: {
              type: 'text_delta',
              text: choice.delta.content,
            },
          })
        );
      }

      if (choice.delta?.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          const existing = this.toolCallBuffer.get(tc.id) ?? '';
          const newArgs = tc.function?.arguments ?? '';
          this.toolCallBuffer.set(tc.id, existing + newArgs);

          events.push(
            this.formatEvent('content_block_delta', {
              index: choice.index,
              delta: {
                type: 'input_json_delta',
                partial_json: newArgs,
              },
            })
          );
        }
      }

      if (choice.finish_reason) {
        events.push(
          this.formatEvent('message_delta', {
            delta: {
              stop_reason: this.mapFinishReason(choice.finish_reason),
            },
          })
        );

        if (parsed.usage) {
          events.push(
            this.formatEvent('message_delta', {
              usage: {
                output_tokens: parsed.usage.completion_tokens,
              },
            })
          );
        }
      }

      return events.join('\n');
    } catch {
      return '';
    }
  }

  private formatEvent(type: string, data: unknown): string {
    return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
  }

  private mapFinishReason(reason: string | null): string {
    const map: Record<string, string> = {
      stop: 'end_turn',
      length: 'max_tokens',
      tool_calls: 'tool_use',
    };
    return map[reason ?? ''] ?? 'end_turn';
  }
}

export async function handleStreamingRequest(
  _request: AnthropicMessageRequest,
  reply: FastifyReply,
  handler: (callbacks: StreamingCallbacks) => Promise<void>
): Promise<void> {
  const adapter = new SSEStreamAdapter();

  const callbacks: StreamingCallbacks = {
    onChunk: (chunk: string) => {
      const anthropicChunk = adapter.toAnthropicSSE(chunk);
      if (anthropicChunk) {
        reply.raw.write(anthropicChunk);
      }
    },
    onError: (error: Error) => {
      reply.raw.write(`event: error\ndata: ${JSON.stringify({ error: error.message })}\n\n`);
      reply.raw.end();
    },
    onComplete: () => {
      reply.raw.write('event: message_stop\ndata: {}\n\n');
      reply.raw.end();
    },
  };

  await handler(callbacks);
}

export function createSSEStreamAdapter(): SSEStreamAdapter {
  return new SSEStreamAdapter();
}
