import { describe, it, expect, beforeEach } from 'vitest';
import {
  createSSEWriter,
  createEventTranslator,
  createStreamParser,
  createStreamingPipeline,
  translateOpenAIStreamToAnthropic,
} from '../../src/streaming/index.js';

describe('SSEWriter', () => {
  let writer: ReturnType<typeof createSSEWriter>;

  beforeEach(() => {
    writer = createSSEWriter();
  });

  describe('writeMessageStart', () => {
    it('should write message_start event', () => {
      const result = writer.writeMessageStart({
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [],
        model: 'claude-3-opus',
        usage: { input_tokens: 10, output_tokens: 0 },
      });

      expect(result).toContain('event: message_start');
      expect(result).toContain('"id":"msg_123"');
      expect(result).toContain('"type":"message"');
      expect(result).toContain('"role":"assistant"');
      expect(result).toContain('"model":"claude-3-opus"');
      expect(result).toContain('"input_tokens":10');
      expect(result).toContain('"output_tokens":0');
    });
  });

  describe('writeTextDelta', () => {
    it('should write text_delta event', () => {
      const result = writer.writeTextDelta(0, 'Hello');

      expect(result).toContain('event: content_block_delta');
      expect(result).toContain('"index":0');
      expect(result).toContain('"type":"text_delta"');
      expect(result).toContain('"text":"Hello"');
    });
  });

  describe('writeInputJsonDelta', () => {
    it('should write input_json_delta event', () => {
      const result = writer.writeInputJsonDelta(0, '{"name":"tool"}');

      expect(result).toContain('event: content_block_delta');
      expect(result).toContain('"index":0');
      expect(result).toContain('"type":"input_json_delta"');
      expect(result).toContain('"partial_json":"{\\"name\\":\\"tool\\"}"');
    });
  });

  describe('writeContentBlockStart', () => {
    it('should write content_block_start event', () => {
      const result = writer.writeContentBlockStart(0, 'text');

      expect(result).toContain('event: content_block_start');
      expect(result).toContain('"index":0');
      expect(result).toContain('"type":"text"');
    });
  });

  describe('writeContentBlockStop', () => {
    it('should write content_block_stop event', () => {
      const result = writer.writeContentBlockStop(0);

      expect(result).toContain('event: content_block_stop');
      expect(result).toContain('"index":0');
    });
  });

  describe('writeMessageDelta', () => {
    it('should write message_delta event with stop_reason', () => {
      const result = writer.writeMessageDelta('end_turn');

      expect(result).toContain('event: message_delta');
      expect(result).toContain('"stop_reason":"end_turn"');
    });

    it('should write message_delta event with usage', () => {
      const result = writer.writeMessageDelta('end_turn', { output_tokens: 50 });

      expect(result).toContain('"stop_reason":"end_turn"');
      expect(result).toContain('"output_tokens":50');
    });
  });

  describe('writeMessageStop', () => {
    it('should write message_stop event', () => {
      const result = writer.writeMessageStop();

      expect(result).toContain('event: message_stop');
    });
  });

  describe('writeError', () => {
    it('should write error event', () => {
      const result = writer.writeError('invalid_request_error', 'Invalid request');

      expect(result).toContain('event: error');
      expect(result).toContain('"type":"invalid_request_error"');
      expect(result).toContain('"message":"Invalid request"');
    });
  });
});

describe('EventTranslator', () => {
  let translator: ReturnType<typeof createEventTranslator>;

  beforeEach(() => {
    translator = createEventTranslator({
      model: 'gpt-4',
      messageId: 'msg_test',
      includeUsage: true,
    });
  });

  describe('translateChunk', () => {
    it('should emit message_start on first chunk', () => {
      const chunk = JSON.stringify({
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: { role: 'assistant', content: '' },
            finish_reason: null,
          },
        ],
      });

      const result = translator.translateChunk(chunk);

      expect(result).toContain('event: message_start');
      expect(result).toContain('"role":"assistant"');
    });

    it('should emit text_delta for content', () => {
      const chunk = JSON.stringify({
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: { content: 'Hello' },
            finish_reason: null,
          },
        ],
      });

      const result = translator.translateChunk(chunk);

      expect(result).toContain('event: content_block_start');
      expect(result).toContain('event: content_block_delta');
      expect(result).toContain('"text":"Hello"');
    });

    it('should emit message_delta with stop_reason on finish', () => {
      const chunk = JSON.stringify({
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      });

      const result = translator.translateChunk(chunk);

      expect(result).toContain('event: message_delta');
      expect(result).toContain('"stop_reason":"end_turn"');
      expect(result).toContain('"output_tokens":5');
    });

    it('should map length finish_reason to max_tokens', () => {
      const chunk = JSON.stringify({
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {},
            finish_reason: 'length',
          },
        ],
      });

      const result = translator.translateChunk(chunk);

      expect(result).toContain('"stop_reason":"max_tokens"');
    });

    it('should handle tool_calls', () => {
      const chunk = JSON.stringify({
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '{"location":',
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      });

      const result = translator.translateChunk(chunk);

      expect(result).toContain('event: content_block_start');
      expect(result).toContain('"type":"tool_use"');
      expect(result).toContain('"input_json_delta"');
    });

    it('should handle incremental tool call arguments', () => {
      const chunk1 = JSON.stringify({
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    name: 'get_weather',
                    arguments: '',
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      });

      translator.translateChunk(chunk1);

      const chunk2 = JSON.stringify({
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: {
                    arguments: '{"location": "NYC"}',
                  },
                },
              ],
            },
            finish_reason: null,
          },
        ],
      });

      const result = translator.translateChunk(chunk2);

      expect(result).toContain('"partial_json":"{\\"location\\": \\"NYC\\"}"');
    });
  });

  describe('finalize', () => {
    it('should emit message_stop on finalize', () => {
      translator.translateChunk(
        JSON.stringify({
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1234567890,
          model: 'gpt-4',
          choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }],
        })
      );

      const result = translator.finalize();

      expect(result).toContain('event: content_block_stop');
      expect(result).toContain('event: message_stop');
    });
  });

  describe('reset', () => {
    it('should reset internal state', () => {
      translator.translateChunk(
        JSON.stringify({
          id: 'chatcmpl-123',
          object: 'chat.completion.chunk',
          created: 1234567890,
          model: 'gpt-4',
          choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }],
        })
      );

      translator.reset();

      const chunk = JSON.stringify({
        id: 'chatcmpl-456',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }],
      });

      const result = translator.translateChunk(chunk);

      expect(result).toContain('event: message_start');
      expect(result).toContain('"text":"Hello"');
    });
  });
});

describe('StreamParser', () => {
  let parser: ReturnType<typeof createStreamParser>;

  beforeEach(() => {
    parser = createStreamParser();
  });

  describe('parse', () => {
    it('should parse single chunk', () => {
      const result = parser.parse('data: {"test":true}\n\n');

      expect(result).toHaveLength(1);
      expect(result[0].data).toBe('{"test":true}');
    });

    it('should parse multiple chunks', () => {
      const result = parser.parse(
        'data: {"id":1}\n\ndata: {"id":2}\n\n'
      );

      expect(result).toHaveLength(2);
      expect(result[0].data).toBe('{"id":1}');
      expect(result[1].data).toBe('{"id":2}');
    });

    it('should handle data: prefix', () => {
      const result = parser.parse('data: test data\n\n');

      expect(result).toHaveLength(1);
      expect(result[0].data).toBe('test data');
    });

    it('should handle [DONE] signal', () => {
      const result = parser.parse('data: [DONE]\n\n');

      expect(result).toHaveLength(1);
      expect(result[0].data).toBe('[DONE]');
    });

    it('should ignore comment lines', () => {
      const result = parser.parse(': This is a comment\ndata: {"test":true}\n\n');

      expect(result).toHaveLength(1);
    });

    it('should extract event type', () => {
      const result = parser.parse('event: message_start\ndata: {"test":true}\n\n');

      expect(result).toHaveLength(1);
      expect(result[0].event).toBe('message_start');
    });

    it('should extract id', () => {
      const result = parser.parse('id: 123\ndata: {"test":true}\n\n');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('123');
    });

    it('should handle incomplete data', () => {
      const result = parser.parse('data: {"incomplete":');

      expect(result).toHaveLength(0);
    });

    it('should handle buffer remainder', () => {
      parser.parse('data: {"first":true}\n\ndata: {"second"');

      const remaining = parser.getRemainingBuffer();

      expect(remaining).toBe('data: {"second"');
    });

    it('should clear buffer', () => {
      parser.parse('data: {"first":true}\n\n');
      parser.clear();

      expect(parser.getRemainingBuffer()).toBe('');
    });
  });
});

describe('StreamingPipeline', () => {
  let pipeline: ReturnType<typeof createStreamingPipeline>;
  let chunks: string[];
  let completed: boolean;

  beforeEach(() => {
    chunks = [];
    completed = false;

    pipeline = createStreamingPipeline(
      {
        model: 'gpt-4',
        messageId: 'msg_test',
        includeUsage: true,
      },
      {
        onChunk: (chunk) => chunks.push(chunk),
        onComplete: () => {
          completed = true;
        },
      }
    );
  });

  describe('processChunk', () => {
    it('should process OpenAI chunk and emit Anthropic events', () => {
      pipeline.start();

      const openaiChunk = JSON.stringify({
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }],
      });

      pipeline.processChunk(openaiChunk);

      const allChunks = chunks.join('');
      expect(allChunks).toContain('message_start');
      expect(allChunks).toContain('content_block_delta');
    });

    it('should not process after finalize', () => {
      pipeline.start();

      const openaiChunk = JSON.stringify({
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }],
      });

      pipeline.processChunk(openaiChunk);
      pipeline.finalize();

      const beforeCount = chunks.length;
      pipeline.processChunk(openaiChunk);

      expect(chunks.length).toBe(beforeCount);
    });

    it('should call onComplete on finalize', () => {
      pipeline.start();
      pipeline.finalize();

      expect(completed).toBe(true);
    });
  });

  describe('processLine', () => {
    it('should process line with data prefix and valid JSON', () => {
      pipeline.start();

      pipeline.processLine('data: {"id":"test","choices":[]}');

      const allChunks = chunks.join('');
      expect(allChunks).toContain('message_start');
    });

    it('should ignore comments', () => {
      pipeline.start();

      pipeline.processLine(': comment');

      expect(chunks.length).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset pipeline state', () => {
      pipeline.start();

      const openaiChunk = JSON.stringify({
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{ index: 0, delta: { content: 'Hi' }, finish_reason: null }],
      });

      pipeline.processChunk(openaiChunk);

      const firstMessageStart = chunks.join('').includes('message_start');

      pipeline.reset();

      chunks.length = 0;

      pipeline.start();
      pipeline.processChunk(openaiChunk);

      expect(chunks.join('').includes('message_start')).toBe(firstMessageStart);
    });
  });
});
