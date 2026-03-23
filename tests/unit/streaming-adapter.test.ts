import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStreamingPipeline } from '../../src/streaming/index.js';

describe('Streaming Adapter - End-to-End', () => {
  describe('Text Delta Streaming', () => {
    it('should stream text content in multiple chunks', () => {
      const chunks: string[] = [];
      const pipeline = createStreamingPipeline(
        { model: 'gpt-4', messageId: 'msg_test', includeUsage: true },
        { onChunk: (chunk) => chunks.push(chunk) }
      );

      pipeline.start();

      pipeline.processChunk(JSON.stringify({
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }],
      }));

      pipeline.processChunk(JSON.stringify({
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{ index: 0, delta: { content: ' World' }, finish_reason: null }],
      }));

      pipeline.finalize();

      const combined = chunks.join('');
      
      expect(combined).toContain('event: message_start');
      expect(combined).toContain('event: content_block_start');
      expect(combined).toContain('event: content_block_delta');
      expect(combined).toContain('"text":"Hello"');
      expect(combined).toContain('"text":" World"');
      expect(combined).toContain('event: message_stop');
    });

    it('should emit message_delta with usage on finish', () => {
      const chunks: string[] = [];
      const pipeline = createStreamingPipeline(
        { model: 'gpt-4', messageId: 'msg_test', includeUsage: true },
        { onChunk: (chunk) => chunks.push(chunk) }
      );

      pipeline.start();

      pipeline.processChunk(JSON.stringify({
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }],
      }));

      pipeline.processChunk(JSON.stringify({
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }));

      const combined = chunks.join('');
      
      expect(combined).toContain('event: message_delta');
      expect(combined).toContain('"stop_reason":"end_turn"');
      expect(combined).toContain('"output_tokens":5');
    });
  });

  describe('Tool Call Streaming', () => {
    it('should stream tool call with incremental arguments', () => {
      const chunks: string[] = [];
      const pipeline = createStreamingPipeline(
        { model: 'gpt-4', messageId: 'msg_test', includeUsage: true },
        { onChunk: (chunk) => chunks.push(chunk) }
      );

      pipeline.start();

      pipeline.processChunk(JSON.stringify({
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{
          index: 0,
          delta: {
            tool_calls: [{
              id: 'call_abc123',
              type: 'function',
              function: { name: 'get_weather', arguments: '' }
            }]
          },
          finish_reason: null,
        }],
      }));

      pipeline.processChunk(JSON.stringify({
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{
          index: 0,
          delta: {
            tool_calls: [{
              id: 'call_abc123',
              type: 'function',
              function: { arguments: '{"location": ' }
            }]
          },
          finish_reason: null,
        }],
      }));

      pipeline.processChunk(JSON.stringify({
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{
          index: 0,
          delta: {
            tool_calls: [{
              id: 'call_abc123',
              type: 'function',
              function: { arguments: '"New York"}' }
            }]
          },
          finish_reason: null,
        }],
      }));

      pipeline.finalize();

      const combined = chunks.join('');
      
      expect(combined).toContain('event: content_block_start');
      expect(combined).toContain('"type":"tool_use"');
      expect(combined).toContain('event: content_block_delta');
      expect(combined).toContain('"input_json_delta"');
      expect(combined).toContain('event: content_block_stop');
    });

    it('should handle tool_calls finish_reason', () => {
      const chunks: string[] = [];
      const pipeline = createStreamingPipeline(
        { model: 'gpt-4', messageId: 'msg_test', includeUsage: true },
        { onChunk: (chunk) => chunks.push(chunk) }
      );

      pipeline.start();

      pipeline.processChunk(JSON.stringify({
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{
          index: 0,
          delta: {
            tool_calls: [{
              id: 'call_abc123',
              type: 'function',
              function: { name: 'get_weather', arguments: '{}' }
            }]
          },
          finish_reason: 'tool_calls',
        }],
      }));

      const combined = chunks.join('');
      
      expect(combined).toContain('"stop_reason":"tool_use"');
    });
  });

  describe('Stream Termination', () => {
    it('should handle [DONE] signal', () => {
      const chunks: string[] = [];
      const completed = vi.fn();
      const pipeline = createStreamingPipeline(
        { model: 'gpt-4', messageId: 'msg_test', includeUsage: true },
        { 
          onChunk: (chunk) => chunks.push(chunk),
          onComplete: completed,
        }
      );

      pipeline.start();

      pipeline.processChunk(JSON.stringify({
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }],
      }));

      pipeline.processChunk('data: [DONE]\n\n');

      const combined = chunks.join('');
      
      expect(combined).toContain('event: message_stop');
      expect(completed).toHaveBeenCalled();
    });

    it('should handle finish_reason null then stop', () => {
      const chunks: string[] = [];
      const pipeline = createStreamingPipeline(
        { model: 'gpt-4', messageId: 'msg_test', includeUsage: true },
        { onChunk: (chunk) => chunks.push(chunk) }
      );

      pipeline.start();

      pipeline.processChunk(JSON.stringify({
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }],
      }));

      pipeline.processChunk(JSON.stringify({
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
      }));

      pipeline.finalize();

      const combined = chunks.join('');
      
      expect(combined).toContain('event: content_block_stop');
      expect(combined).toContain('event: message_delta');
      expect(combined).toContain('event: message_stop');
    });
  });

  describe('Error Streaming', () => {
    it('should emit error event via writeError', () => {
      const chunks: string[] = [];
      const pipeline = createStreamingPipeline(
        { model: 'gpt-4', messageId: 'msg_test', includeUsage: true },
        { onChunk: (chunk) => chunks.push(chunk) }
      );

      pipeline.start();

      const errorEvent = pipeline.writeError('rate_limit_error', 'Rate limit exceeded');

      chunks.push(errorEvent);

      const combined = chunks.join('');
      
      expect(combined).toContain('event: error');
      expect(combined).toContain('"type":"rate_limit_error"');
      expect(combined).toContain('"message":"Rate limit exceeded"');
    });

    it('should not emit chunks after finalize', () => {
      const chunks: string[] = [];
      const pipeline = createStreamingPipeline(
        { model: 'gpt-4', messageId: 'msg_test', includeUsage: true },
        { onChunk: (chunk) => chunks.push(chunk) }
      );

      pipeline.start();

      pipeline.processChunk(JSON.stringify({
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }],
      }));

      pipeline.finalize();

      const countBefore = chunks.length;

      pipeline.processChunk(JSON.stringify({
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{ index: 0, delta: { content: 'More' }, finish_reason: null }],
      }));

      expect(chunks.length).toBe(countBefore);
    });
  });

  describe('Claude Code CLI Compatibility', () => {
    it('should emit proper event sequence for Claude Code', () => {
      const chunks: string[] = [];
      const pipeline = createStreamingPipeline(
        { model: 'claude-3-opus-20240229', messageId: 'msg_claude_test', includeUsage: true },
        { onChunk: (chunk) => chunks.push(chunk) }
      );

      pipeline.start();

      pipeline.processChunk(JSON.stringify({
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'claude-3-opus-20240229',
        choices: [{ index: 0, delta: { content: 'I can help you with that.' }, finish_reason: null }],
      }));

      pipeline.processChunk(JSON.stringify({
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'claude-3-opus-20240229',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 },
      }));

      pipeline.finalize();

      const combined = chunks.join('');
      const eventTypes = combined.match(/event: (\w+)/g) ?? [];
      
      expect(eventTypes).toContain('event: message_start');
      expect(eventTypes).toContain('event: content_block_start');
      expect(eventTypes).toContain('event: content_block_delta');
      expect(eventTypes).toContain('event: content_block_stop');
      expect(eventTypes).toContain('event: message_delta');
      expect(eventTypes).toContain('event: message_stop');
    });

    it('should handle include_usage option correctly', () => {
      const chunks: string[] = [];
      const pipeline = createStreamingPipeline(
        { model: 'gpt-4', messageId: 'msg_test', includeUsage: false },
        { onChunk: (chunk) => chunks.push(chunk) }
      );

      pipeline.start();

      pipeline.processChunk(JSON.stringify({
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }],
      }));

      pipeline.processChunk(JSON.stringify({
        id: 'chatcmpl-1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      }));

      pipeline.finalize();

      const combined = chunks.join('');
      
      expect(combined).toContain('"stop_reason":"end_turn"');
      expect(combined).not.toContain('"output_tokens":5');
    });
  });
});
