import { describe, it, expect } from 'vitest';
import {
  AnthropicMessageRequestSchema,
  AnthropicMessageResponseSchema,
  AnthropicToolChoiceSchema,
  AnthropicUsageSchema,
  ANTHROPIC_CONTENT_BLOCK_TYPES,
  ANTHROPIC_MESSAGE_ROLES,
  ANTHROPIC_STOP_REASONS,
  ANTHROPIC_TOOL_CHOICE_TYPES,
  ANTHROPIC_IMAGE_MEDIA_TYPES,
} from '../../src/schemas/anthropic.js';
import {
  OpenAIChatCompletionRequestSchema,
  OpenAIChatCompletionResponseSchema,
  OpenAIChatCompletionChunkSchema,
  OpenAIToolChoiceSchema,
  OpenAIUsageSchema,
  OPENAI_MESSAGE_ROLES,
  OPENAI_CONTENT_PART_TYPES,
  OPENAI_TOOL_TYPES,
  OPENAI_TOOL_CHOICE_TYPES,
  OPENAI_FINISH_REASONS,
  OPENAI_IMAGE_DETAIL,
} from '../../src/schemas/openai.js';
import {
  CanonicalRequestSchema,
  CanonicalResponseSchema,
  CanonicalMessageSchema,
  CanonicalContentSchema,
  CanonicalToolChoiceSchema,
  CanonicalUsageSchema,
  CANONICAL_MESSAGE_ROLES,
  CANONICAL_CONTENT_TYPES,
  CANONICAL_STOP_REASONS,
} from '../../src/schemas/canonical.js';

describe('Anthropic Schemas', () => {
  describe('AnthropicMessageRequestSchema', () => {
    it('should validate a minimal valid request', () => {
      const validRequest = {
        model: 'claude-3-5-sonnet-20240620',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1024,
      };

      const result = AnthropicMessageRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.model).toBe('claude-3-5-sonnet-20240620');
        expect(result.data.messages).toHaveLength(1);
      }
    });

    it('should validate request with all optional fields', () => {
      const fullRequest = {
        model: 'claude-3-5-sonnet-20240620',
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
        ],
        system: 'You are a helpful assistant.',
        max_tokens: 2048,
        temperature: 0.7,
        top_p: 0.9,
        top_k: 40,
        stop_sequences: ['END', 'STOP'],
        tools: [
          {
            name: 'get_weather',
            description: 'Get weather for a location',
            input_schema: {
              type: 'object',
              properties: {
                location: { type: 'string' },
              },
              required: ['location'],
            },
          },
        ],
        tool_choice: { type: 'auto' },
        stream: false,
        metadata: { user_id: '123' },
      };

      const result = AnthropicMessageRequestSchema.safeParse(fullRequest);
      expect(result.success).toBe(true);
    });

    it('should reject request with empty messages array', () => {
      const invalidRequest = {
        model: 'claude-3-5-sonnet-20240620',
        messages: [],
        max_tokens: 1024,
      };

      const result = AnthropicMessageRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject request with invalid role', () => {
      const invalidRequest = {
        model: 'claude-3-5-sonnet-20240620',
        messages: [{ role: 'invalid', content: 'Hello' }],
        max_tokens: 1024,
      };

      const result = AnthropicMessageRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject request with temperature out of range', () => {
      const invalidRequest = {
        model: 'claude-3-5-sonnet-20240620',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1024,
        temperature: 1.5,
      };

      const result = AnthropicMessageRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should reject request with non-positive max_tokens', () => {
      const invalidRequest = {
        model: 'claude-3-5-sonnet-20240620',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 0,
      };

      const result = AnthropicMessageRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should validate system prompt as string', () => {
      const request = {
        model: 'claude-3-5-sonnet-20240620',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1024,
        system: 'You are a helpful assistant.',
      };

      const result = AnthropicMessageRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate system prompt as array', () => {
      const request = {
        model: 'claude-3-5-sonnet-20240620',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1024,
        system: [
          { type: 'text', text: 'You are a helpful assistant.' },
          { type: 'text', text: 'Be concise.', cache_control: { type: 'ephemeral', ttl: '5m' } },
        ],
      };

      const result = AnthropicMessageRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate content blocks', () => {
      const request = {
        model: 'claude-3-5-sonnet-20240620',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'Hello' },
              { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'abc123' } },
            ],
          },
        ],
        max_tokens: 1024,
      };

      const result = AnthropicMessageRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate tool_choice types correctly', () => {
      const autoChoice = { type: 'auto' as const };
      const anyChoice = { type: 'any' as const };
      const toolChoice = { type: 'tool' as const, name: 'get_weather' };

      expect(AnthropicToolChoiceSchema.safeParse(autoChoice).success).toBe(true);
      expect(AnthropicToolChoiceSchema.safeParse(anyChoice).success).toBe(true);
      expect(AnthropicToolChoiceSchema.safeParse(toolChoice).success).toBe(true);
    });

    it('should reject invalid tool_choice', () => {
      const invalidChoice = { type: 'invalid' };
      const result = AnthropicToolChoiceSchema.safeParse(invalidChoice);
      expect(result.success).toBe(false);
    });
  });

  describe('AnthropicMessageResponseSchema', () => {
    it('should validate a complete response', () => {
      const response = {
        id: 'msg_abc123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }],
        model: 'claude-3-5-sonnet-20240620',
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 5,
        },
      };

      const result = AnthropicMessageResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate response with tool_use', () => {
      const response = {
        id: 'msg_abc123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'tool_use', id: 'toolu_123', name: 'get_weather', input: { location: 'NYC' } },
        ],
        model: 'claude-3-5-sonnet-20240620',
        stop_reason: 'tool_use',
        usage: {
          input_tokens: 50,
          output_tokens: 20,
        },
      };

      const result = AnthropicMessageResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate stop_reason enum values', () => {
      const stopReasons = ['end_turn', 'max_tokens', 'stop_sequence', 'tool_use', 'pause_turn'];

      for (const reason of stopReasons) {
        const response = {
          id: 'msg_abc123',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'text', text: 'Hello' }],
          model: 'claude-3-5-sonnet-20240620',
          stop_reason: reason,
          usage: { input_tokens: 10, output_tokens: 5 },
        };

        expect(AnthropicMessageResponseSchema.safeParse(response).success).toBe(true);
      }
    });
  });

  describe('AnthropicUsageSchema', () => {
    it('should validate basic usage', () => {
      const usage = { input_tokens: 100, output_tokens: 50 };
      const result = AnthropicUsageSchema.safeParse(usage);
      expect(result.success).toBe(true);
    });

    it('should validate usage with cache tokens', () => {
      const usage = {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 30,
        cache_read_input_tokens: 70,
      };
      const result = AnthropicUsageSchema.safeParse(usage);
      expect(result.success).toBe(true);
    });

    it('should reject negative tokens', () => {
      const usage = { input_tokens: -10, output_tokens: 50 };
      const result = AnthropicUsageSchema.safeParse(usage);
      expect(result.success).toBe(false);
    });
  });
});

describe('OpenAI Schemas', () => {
  describe('OpenAIChatCompletionRequestSchema', () => {
    it('should validate a minimal valid request', () => {
      const validRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
      };

      const result = OpenAIChatCompletionRequestSchema.safeParse(validRequest);
      expect(result.success).toBe(true);
    });

    it('should validate request with all optional fields', () => {
      const fullRequest = {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: 'You are helpful.' },
          { role: 'user', content: 'Hello' },
        ],
        temperature: 0.7,
        top_p: 0.9,
        n: 1,
        stream: false,
        stop: ['END'],
        max_tokens: 1024,
        max_completion_tokens: 2048,
        presence_penalty: 0.5,
        frequency_penalty: 0.5,
        user: 'user_123',
        tools: [
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get weather',
              parameters: { type: 'object', properties: { location: { type: 'string' } } },
            },
          },
        ],
        tool_choice: 'auto',
        stream_options: { include_usage: true },
        metadata: { user_id: '123' },
      };

      const result = OpenAIChatCompletionRequestSchema.safeParse(fullRequest);
      expect(result.success).toBe(true);
    });

    it('should validate tool_choice types', () => {
      expect(OpenAIToolChoiceSchema.safeParse('auto').success).toBe(true);
      expect(OpenAIToolChoiceSchema.safeParse('required').success).toBe(true);
      expect(OpenAIToolChoiceSchema.safeParse('none').success).toBe(true);
      expect(OpenAIToolChoiceSchema.safeParse({ type: 'function', function: { name: 'test' } }).success).toBe(true);
    });

    it('should reject temperature above 2', () => {
      const invalidRequest = {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'Hello' }],
        temperature: 2.5,
      };

      const result = OpenAIChatCompletionRequestSchema.safeParse(invalidRequest);
      expect(result.success).toBe(false);
    });

    it('should validate assistant message with tool_calls', () => {
      const request = {
        model: 'gpt-4o',
        messages: [
          {
            role: 'assistant',
            content: 'I will check the weather.',
            tool_calls: [
              { id: 'call_123', type: 'function', function: { name: 'get_weather', arguments: '{"location":"NYC"}' } },
            ],
          },
        ],
      };

      const result = OpenAIChatCompletionRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate tool message', () => {
      const request = {
        model: 'gpt-4o',
        messages: [
          { role: 'tool', content: 'Sunny, 72°F', tool_call_id: 'call_123' },
        ],
      };

      const result = OpenAIChatCompletionRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate image content', () => {
      const request = {
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What is in this image?' },
              { type: 'image_url', image_url: { url: 'https://example.com/image.jpg', detail: 'high' } },
            ],
          },
        ],
      };

      const result = OpenAIChatCompletionRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });
  });

  describe('OpenAIChatCompletionResponseSchema', () => {
    it('should validate a complete response', () => {
      const response = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello!' },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
      };

      const result = OpenAIChatCompletionResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate response with tool_calls finish_reason', () => {
      const response = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'I will check the weather.',
              tool_calls: [
                { id: 'call_123', type: 'function', function: { name: 'get_weather', arguments: '{}' } },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
      };

      const result = OpenAIChatCompletionResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate streaming chunk', () => {
      const chunk = {
        id: 'chatcmpl-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [
          { index: 0, delta: { content: 'Hello' }, finish_reason: null },
        ],
      };

      const result = OpenAIChatCompletionChunkSchema.safeParse(chunk);
      expect(result.success).toBe(true);
    });
  });

  describe('OpenAIUsageSchema', () => {
    it('should validate basic usage', () => {
      const usage = { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 };
      const result = OpenAIUsageSchema.safeParse(usage);
      expect(result.success).toBe(true);
    });

    it('should validate usage with details', () => {
      const usage = {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
        prompt_tokens_details: { cached_tokens: 30 },
        completion_tokens_details: { reasoning_tokens: 20 },
      };
      const result = OpenAIUsageSchema.safeParse(usage);
      expect(result.success).toBe(true);
    });

    it('should accept total_tokens even if not equal to sum (Zod does not enforce computed)', () => {
      const usage = { prompt_tokens: 100, completion_tokens: 50, total_tokens: 200 };
      const result = OpenAIUsageSchema.safeParse(usage);
      expect(result.success).toBe(true);
    });
  });
});

describe('Canonical Schemas', () => {
  describe('CanonicalRequestSchema', () => {
    it('should validate a minimal canonical request', () => {
      const request = {
        model: 'claude-3-5-sonnet-20240620',
        messages: [
          { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        ],
        max_tokens: 1024,
      };

      const result = CanonicalRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate full canonical request', () => {
      const request = {
        model: 'claude-3-5-sonnet-20240620',
        messages: [
          { role: 'system', content: [{ type: 'text', text: 'You are helpful.' }] },
          { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        ],
        system: 'You are helpful.',
        max_tokens: 2048,
        temperature: 0.7,
        top_p: 0.9,
        stop_sequences: ['END'],
        tools: [
          { name: 'get_weather', description: 'Get weather', parameters: { type: 'object' } },
        ],
        tool_choice: 'auto',
        stream: false,
        metadata: { user_id: '123' },
      };

      const result = CanonicalRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    it('should validate canonical tool_choice', () => {
      expect(CanonicalToolChoiceSchema.safeParse('auto').success).toBe(true);
      expect(CanonicalToolChoiceSchema.safeParse('required').success).toBe(true);
      expect(CanonicalToolChoiceSchema.safeParse({ type: 'tool', name: 'get_weather' }).success).toBe(true);
    });
  });

  describe('CanonicalResponseSchema', () => {
    it('should validate a canonical response', () => {
      const response = {
        id: 'msg_abc123',
        model: 'claude-3-5-sonnet-20240620',
        content: [{ type: 'text', text: 'Hello!' }],
        stop_reason: 'end_turn',
        usage: {
          input_tokens: 10,
          output_tokens: 5,
          total_tokens: 15,
        },
      };

      const result = CanonicalResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    it('should validate response with tool_call', () => {
      const response = {
        id: 'msg_abc123',
        model: 'claude-3-5-sonnet-20240620',
        content: [
          {
            type: 'tool_call',
            id: 'toolu_123',
            name: 'get_weather',
            arguments: { location: 'NYC' },
          },
        ],
        stop_reason: 'tool_call',
        usage: { input_tokens: 50, output_tokens: 20, total_tokens: 70 },
      };

      const result = CanonicalResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });

  describe('CanonicalMessageSchema', () => {
    it('should validate user message', () => {
      const message = {
        role: 'user' as const,
        content: [{ type: 'text' as const, text: 'Hello' }],
      };
      expect(CanonicalMessageSchema.safeParse(message).success).toBe(true);
    });

    it('should validate assistant message with tool_call', () => {
      const message = {
        role: 'assistant' as const,
        content: [
          { type: 'tool_call' as const, id: 'call_123', name: 'get_weather', arguments: { location: 'NYC' } },
        ],
      };
      expect(CanonicalMessageSchema.safeParse(message).success).toBe(true);
    });

    it('should validate tool result message', () => {
      const message = {
        role: 'tool' as const,
        content: [
          { type: 'tool_result' as const, tool_call_id: 'call_123', content: 'Sunny, 72°F' },
        ],
        tool_call_id: 'call_123',
      };
      expect(CanonicalMessageSchema.safeParse(message).success).toBe(true);
    });

    it('should validate system message', () => {
      const message = {
        role: 'system' as const,
        content: [{ type: 'text' as const, text: 'You are helpful.' }],
      };
      expect(CanonicalMessageSchema.safeParse(message).success).toBe(true);
    });
  });

  describe('CanonicalContentSchema', () => {
    it('should validate text content', () => {
      const content = { type: 'text' as const, text: 'Hello world' };
      expect(CanonicalContentSchema.safeParse(content).success).toBe(true);
    });

    it('should validate image content', () => {
      const content = {
        type: 'image' as const,
        url: 'data:image/jpeg;base64,abc123',
        mimeType: 'image/jpeg' as const,
        isBase64: true,
      };
      expect(CanonicalContentSchema.safeParse(content).success).toBe(true);
    });

    it('should validate tool_call content', () => {
      const content = {
        type: 'tool_call' as const,
        id: 'call_123',
        name: 'get_weather',
        arguments: { location: 'NYC' },
      };
      expect(CanonicalContentSchema.safeParse(content).success).toBe(true);
    });

    it('should validate tool_result content', () => {
      const content = {
        type: 'tool_result' as const,
        tool_call_id: 'call_123',
        content: 'Sunny, 72°F',
        is_error: false,
      };
      expect(CanonicalContentSchema.safeParse(content).success).toBe(true);
    });
  });

  describe('CanonicalUsageSchema', () => {
    it('should validate basic usage', () => {
      const usage = { input_tokens: 100, output_tokens: 50, total_tokens: 150 };
      expect(CanonicalUsageSchema.safeParse(usage).success).toBe(true);
    });

    it('should validate usage with cache and reasoning tokens', () => {
      const usage = {
        input_tokens: 100,
        output_tokens: 50,
        total_tokens: 150,
        cached_tokens: 30,
        reasoning_tokens: 20,
      };
      expect(CanonicalUsageSchema.safeParse(usage).success).toBe(true);
    });

    it('should reject negative tokens', () => {
      const usage = { input_tokens: -10, output_tokens: 50, total_tokens: 40 };
      expect(CanonicalUsageSchema.safeParse(usage).success).toBe(false);
    });
  });
});

describe('Schema Constants', () => {
  describe('Anthropic constants', () => {
    it('should have correct content block types', () => {
      expect(ANTHROPIC_CONTENT_BLOCK_TYPES.TEXT).toBe('text');
      expect(ANTHROPIC_CONTENT_BLOCK_TYPES.IMAGE).toBe('image');
      expect(ANTHROPIC_CONTENT_BLOCK_TYPES.TOOL_USE).toBe('tool_use');
      expect(ANTHROPIC_CONTENT_BLOCK_TYPES.TOOL_RESULT).toBe('tool_result');
    });

    it('should have correct message roles', () => {
      expect(ANTHROPIC_MESSAGE_ROLES.USER).toBe('user');
      expect(ANTHROPIC_MESSAGE_ROLES.ASSISTANT).toBe('assistant');
    });

    it('should have correct stop reasons', () => {
      expect(ANTHROPIC_STOP_REASONS.END_TURN).toBe('end_turn');
      expect(ANTHROPIC_STOP_REASONS.MAX_TOKENS).toBe('max_tokens');
      expect(ANTHROPIC_STOP_REASONS.TOOL_USE).toBe('tool_use');
    });

    it('should have correct tool choice types', () => {
      expect(ANTHROPIC_TOOL_CHOICE_TYPES.AUTO).toBe('auto');
      expect(ANTHROPIC_TOOL_CHOICE_TYPES.ANY).toBe('any');
      expect(ANTHROPIC_TOOL_CHOICE_TYPES.TOOL).toBe('tool');
    });

    it('should have correct image media types', () => {
      expect(ANTHROPIC_IMAGE_MEDIA_TYPES).toContain('image/jpeg');
      expect(ANTHROPIC_IMAGE_MEDIA_TYPES).toContain('image/png');
      expect(ANTHROPIC_IMAGE_MEDIA_TYPES).toContain('image/gif');
      expect(ANTHROPIC_IMAGE_MEDIA_TYPES).toContain('image/webp');
    });
  });

  describe('OpenAI constants', () => {
    it('should have correct message roles', () => {
      expect(OPENAI_MESSAGE_ROLES.SYSTEM).toBe('system');
      expect(OPENAI_MESSAGE_ROLES.USER).toBe('user');
      expect(OPENAI_MESSAGE_ROLES.ASSISTANT).toBe('assistant');
      expect(OPENAI_MESSAGE_ROLES.DEVELOPER).toBe('developer');
    });

    it('should have correct content part types', () => {
      expect(OPENAI_CONTENT_PART_TYPES.TEXT).toBe('text');
      expect(OPENAI_CONTENT_PART_TYPES.IMAGE_URL).toBe('image_url');
    });

    it('should have correct finish reasons', () => {
      expect(OPENAI_FINISH_REASONS.STOP).toBe('stop');
      expect(OPENAI_FINISH_REASONS.LENGTH).toBe('length');
      expect(OPENAI_FINISH_REASONS.TOOL_CALLS).toBe('tool_calls');
    });

    it('should have correct tool types', () => {
      expect(OPENAI_TOOL_TYPES.FUNCTION).toBe('function');
    });

    it('should have correct image detail values', () => {
      expect(OPENAI_IMAGE_DETAIL.LOW).toBe('low');
      expect(OPENAI_IMAGE_DETAIL.HIGH).toBe('high');
      expect(OPENAI_IMAGE_DETAIL.AUTO).toBe('auto');
    });
  });

  describe('Canonical constants', () => {
    it('should have correct message roles', () => {
      expect(CANONICAL_MESSAGE_ROLES.USER).toBe('user');
      expect(CANONICAL_MESSAGE_ROLES.ASSISTANT).toBe('assistant');
      expect(CANONICAL_MESSAGE_ROLES.SYSTEM).toBe('system');
      expect(CANONICAL_MESSAGE_ROLES.TOOL).toBe('tool');
    });

    it('should have correct content types', () => {
      expect(CANONICAL_CONTENT_TYPES.TEXT).toBe('text');
      expect(CANONICAL_CONTENT_TYPES.IMAGE).toBe('image');
      expect(CANONICAL_CONTENT_TYPES.TOOL_CALL).toBe('tool_call');
      expect(CANONICAL_CONTENT_TYPES.TOOL_RESULT).toBe('tool_result');
    });

    it('should have correct stop reasons', () => {
      expect(CANONICAL_STOP_REASONS.END_TURN).toBe('end_turn');
      expect(CANONICAL_STOP_REASONS.MAX_TOKENS).toBe('max_tokens');
      expect(CANONICAL_STOP_REASONS.TOOL_CALL).toBe('tool_call');
    });
  });
});

describe('Cross-schema validation', () => {
  it('should convert Anthropic request to canonical format', () => {
    const anthropicRequest = {
      model: 'claude-3-5-sonnet-20240620',
      messages: [{ role: 'user', content: 'Hello' }],
      max_tokens: 1024,
      temperature: 0.7,
    };

    const parsed = AnthropicMessageRequestSchema.parse(anthropicRequest);

    const canonical = {
      model: parsed.model,
      messages: parsed.messages.map((msg) => ({
        role: msg.role,
        content: typeof msg.content === 'string'
          ? [{ type: 'text' as const, text: msg.content }]
          : msg.content.map((c) => {
              if (typeof c === 'string') return { type: 'text' as const, text: c };
              return { type: 'text' as const, text: (c as { text: string }).text };
            }),
      })),
      max_tokens: parsed.max_tokens,
      temperature: parsed.temperature,
    };

    const result = CanonicalRequestSchema.safeParse(canonical);
    expect(result.success).toBe(true);
  });

  it('should convert OpenAI request to canonical format', () => {
    const openaiRequest = {
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'Hello' }],
      temperature: 0.7,
    };

    const parsed = OpenAIChatCompletionRequestSchema.parse(openaiRequest);

    const canonical = {
      model: parsed.model,
      messages: parsed.messages.map((msg) => ({
        role: msg.role === 'developer' ? 'assistant' : msg.role,
        content: typeof msg.content === 'string'
          ? [{ type: 'text' as const, text: msg.content }]
          : msg.content.map((c) => ({ type: 'text' as const, text: c.text })),
      })),
      max_tokens: parsed.max_tokens ?? 4096,
      temperature: parsed.temperature,
    };

    const result = CanonicalRequestSchema.safeParse(canonical);
    expect(result.success).toBe(true);
  });
});
