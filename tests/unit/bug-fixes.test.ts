import { describe, it, expect, beforeEach } from 'vitest';
import { createStreamingPipeline } from '../../src/streaming/index.js';
import {
  normalizeAnthropicRequest,
  denormalizeOpenAIResponse,
  convertToolResultToOpenAI,
} from '../../src/adapters/request.js';

describe('Bug Fixes', () => {
  describe('Fix #4: Empty choices array handling', () => {
    it('should handle response with empty choices array', () => {
      const response = {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4',
        choices: [],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 0,
          total_tokens: 10,
        },
      };

      const result = denormalizeOpenAIResponse(response as any, 'claude-3-opus');

      expect(result.content).toEqual([]);
      expect(result.stop_reason).toBe('end_turn');
      expect(result.usage.input_tokens).toBe(10);
      expect(result.usage.output_tokens).toBe(0);
    });

    it('should handle response with undefined choices', () => {
      const response = {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4',
        usage: {
          prompt_tokens: 10,
          completion_tokens: 0,
          total_tokens: 10,
        },
      };

      const result = denormalizeOpenAIResponse(response as any, 'claude-3-opus');

      expect(result.content).toEqual([]);
      expect(result.stop_reason).toBe('end_turn');
    });

    it('should handle response with null message', () => {
      const response = {
        id: 'chatcmpl-test',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{ message: null, finish_reason: 'stop' }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      const result = denormalizeOpenAIResponse(response as any, 'claude-3-opus');

      expect(result.content).toEqual([]);
      expect(result.stop_reason).toBe('end_turn');
      expect(result.usage.output_tokens).toBe(5);
    });
  });

  describe('Fix #5: Multiple tool results mapping', () => {
    it('should preserve tool_call_id for each tool result', () => {
      const request = {
        model: 'claude-3-opus',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'call_abc123',
                content: 'Result for tool 1',
              },
              {
                type: 'tool_result',
                tool_use_id: 'call_xyz789',
                content: 'Result for tool 2',
              },
            ],
          },
        ],
        max_tokens: 1024,
      };

      const normalized = normalizeAnthropicRequest(request, {});

      // Should have 2 separate tool messages
      const toolMessages = normalized.openai.messages.filter(
        (m: any) => m.role === 'tool'
      );

      expect(toolMessages).toHaveLength(2);
      expect(toolMessages[0].tool_call_id).toBe('call_abc123');
      expect(toolMessages[0].content).toBe('Result for tool 1');
      expect(toolMessages[1].tool_call_id).toBe('call_xyz789');
      expect(toolMessages[1].content).toBe('Result for tool 2');
    });

    it('should handle single tool result correctly', () => {
      const request = {
        model: 'claude-3-opus',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'call_single',
                content: 'Single result',
              },
            ],
          },
        ],
        max_tokens: 1024,
      };

      const normalized = normalizeAnthropicRequest(request, {});

      const toolMessages = normalized.openai.messages.filter(
        (m: any) => m.role === 'tool'
      );

      expect(toolMessages).toHaveLength(1);
      expect(toolMessages[0].tool_call_id).toBe('call_single');
    });

    it('should handle object content in tool result', () => {
      const request = {
        model: 'claude-3-opus',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: 'call_obj',
                content: { key: 'value', nested: { a: 1 } },
              },
            ],
          },
        ],
        max_tokens: 1024,
      };

      const normalized = normalizeAnthropicRequest(request, {});

      const toolMessage = normalized.openai.messages.find(
        (m: any) => m.role === 'tool'
      ) as any;

      expect(toolMessage.tool_call_id).toBe('call_obj');
      expect(toolMessage.content).toBe('{"key":"value","nested":{"a":1}}');
    });
  });

  describe('Fix #7 & #1-3: Streaming error handling', () => {
    it('should call onComplete after onError handles error', () => {
      const chunks: string[] = [];
      let errorCalled = false;
      let completeCalled = false;

      const pipeline = createStreamingPipeline(
        { model: 'gpt-4', messageId: 'msg_test', includeUsage: true },
        {
          onChunk: (chunk) => chunks.push(chunk),
          onError: () => {
            errorCalled = true;
          },
          onComplete: () => {
            completeCalled = true;
          },
        }
      );

      pipeline.start();

      // Send a chunk first
      pipeline.processChunk(JSON.stringify({
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }],
      }));

      // Now simulate buffer overflow
      const largeChunk = 'x'.repeat(1024 * 1024 + 1);
      pipeline.processChunk(largeChunk);

      expect(errorCalled).toBe(true);
      expect(completeCalled).toBe(true);
      expect(chunks.join('')).toContain('event: message_stop');
    });

    it('should not process chunks after error', () => {
      const chunks: string[] = [];

      const pipeline = createStreamingPipeline(
        { model: 'gpt-4', messageId: 'msg_test', includeUsage: true },
        {
          onChunk: (chunk) => chunks.push(chunk),
        }
      );

      pipeline.start();

      // Trigger error
      pipeline.processChunk('x'.repeat(1024 * 1024 + 1));

      const countAfterError = chunks.length;

      // Try to send more chunks
      pipeline.processChunk(JSON.stringify({
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{ index: 0, delta: { content: 'Should not appear' }, finish_reason: null }],
      }));

      // Should not have added more chunks
      expect(chunks.length).toBe(countAfterError);
    });

    it('should handle finalize after error gracefully', () => {
      const chunks: string[] = [];

      const pipeline = createStreamingPipeline(
        { model: 'gpt-4', messageId: 'msg_test', includeUsage: true },
        {
          onChunk: (chunk) => chunks.push(chunk),
        }
      );

      pipeline.start();

      // Trigger error
      pipeline.processChunk('x'.repeat(1024 * 1024 + 1));

      // Try to finalize - should not throw
      expect(() => pipeline.finalize()).not.toThrow();
    });

    it('should reset hasErrored state on reset', () => {
      const pipeline = createStreamingPipeline(
        { model: 'gpt-4', messageId: 'msg_test', includeUsage: true },
        {}
      );

      pipeline.start();

      // Trigger error
      pipeline.processChunk('x'.repeat(1024 * 1024 + 1));

      // Reset
      pipeline.reset();

      // Should be able to process chunks again
      const chunks: string[] = [];
      const newPipeline = createStreamingPipeline(
        { model: 'gpt-4', messageId: 'msg_test2', includeUsage: true },
        { onChunk: (c) => chunks.push(c) }
      );

      newPipeline.start();
      newPipeline.processChunk(JSON.stringify({
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }],
      }));

      expect(chunks.join('')).toContain('message_start');
    });
  });

  describe('Fix #8: Buffer size limit', () => {
    it('should reject chunks that exceed buffer limit', () => {
      const errorChunks: string[] = [];

      const pipeline = createStreamingPipeline(
        { model: 'gpt-4', messageId: 'msg_test', includeUsage: true },
        {
          onChunk: () => {},
          onError: (e) => errorChunks.push(e.message),
        }
      );

      pipeline.start();

      // Send a chunk that's too large
      const largeChunk = 'x'.repeat(1024 * 1024 + 1);
      pipeline.processChunk(largeChunk);

      expect(errorChunks[0]).toContain('buffer overflow');
    });

    it('should reject lines that exceed buffer limit', () => {
      const errorChunks: string[] = [];

      const pipeline = createStreamingPipeline(
        { model: 'gpt-4', messageId: 'msg_test', includeUsage: true },
        {
          onChunk: () => {},
          onError: (e) => errorChunks.push(e.message),
        }
      );

      pipeline.start();

      // Send a line that's too large
      const largeLine = 'x'.repeat(1024 * 1024 + 1);
      pipeline.processLine(largeLine);

      expect(errorChunks[0]).toContain('buffer overflow');
    });
  });

  describe('convertToolResultToOpenAI', () => {
    it('should convert string result', () => {
      const result = convertToolResultToOpenAI('call_123', 'string result');

      expect(result.role).toBe('tool');
      expect(result.content).toBe('string result');
      expect(result.tool_call_id).toBe('call_123');
    });

    it('should convert object result to JSON', () => {
      const result = convertToolResultToOpenAI('call_123', { key: 'value' });

      expect(result.role).toBe('tool');
      expect(result.content).toBe('{"key":"value"}');
      expect(result.tool_call_id).toBe('call_123');
    });
  });
});
