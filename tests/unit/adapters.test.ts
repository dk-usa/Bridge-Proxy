import { describe, it, expect } from 'vitest';
import {
  normalizeAnthropicRequest,
  denormalizeOpenAIResponse,
  convertToolResultToAnthropic,
  convertToolResultToOpenAI,
} from '../../src/adapters/request.js';

describe('Anthropic to OpenAI Request Adapter', () => {
  describe('normalizeAnthropicRequest', () => {
    describe('basic message conversion', () => {
      it('should convert simple text message', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [{ role: 'user', content: 'Hello, how are you?' }],
          max_tokens: 1024,
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.model).toBe('claude-3-5-sonnet-20240620');
        expect(result.openai.messages).toHaveLength(1);
        expect(result.openai.messages[0]).toEqual({
          role: 'user',
          content: 'Hello, how are you?',
        });
        expect(result.openai.max_tokens).toBe(1024);
      });

      it('should apply model mapping', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 1024,
        };

        const modelMapping = {
          'claude-3-5-sonnet-20240620': 'meta/llama-3.1-70b-instruct',
        };

        const result = normalizeAnthropicRequest(request, modelMapping);

        expect(result.openai.model).toBe('meta/llama-3.1-70b-instruct');
      });

      it('should use original model when mapping not found', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 1024,
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.model).toBe('claude-3-5-sonnet-20240620');
      });
    });

    describe('system prompt conversion', () => {
      it('should convert string system prompt', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 1024,
          system: 'You are a helpful coding assistant.',
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.messages[0]).toEqual({
          role: 'system',
          content: 'You are a helpful coding assistant.',
        });
      });

      it('should convert array system prompt', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 1024,
          system: [
            { type: 'text', text: 'You are a helpful assistant.' },
            { type: 'text', text: 'Always write clean code.' },
          ],
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.messages[0]).toEqual({
          role: 'system',
          content: 'You are a helpful assistant.\nAlways write clean code.',
        });
      });

      it('should handle system prompt with cache_control', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 1024,
          system: [
            { type: 'text', text: 'System prompt', cache_control: { type: 'ephemeral', ttl: '5m' } },
          ],
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.messages[0].role).toBe('system');
        expect(result.openai.messages[0].content).toContain('System prompt');
      });
    });

    describe('text content blocks', () => {
      it('should convert text content block', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [
            {
              role: 'user',
              content: [{ type: 'text', text: 'Hello world' }],
            },
          ],
          max_tokens: 1024,
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.messages[0].content).toBe('Hello world');
      });

      it('should convert multiple text blocks', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'Part 1 ' },
                { type: 'text', text: 'Part 2' },
              ],
            },
          ],
          max_tokens: 1024,
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.messages[0].content).toBe('Part 1 \nPart 2');
      });

      it('should handle mixed string and text blocks', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [
            {
              role: 'user',
              content: ['Hello ', { type: 'text', text: 'world' }],
            },
          ],
          max_tokens: 1024,
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.messages[0].content).toBe('Hello \nworld');
      });
    });

    describe('image content blocks', () => {
      it('should convert base64 JPEG image', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: 'What is in this image?' },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: 'SGVsbG8gV29ybGQ=',
                  },
                },
              ],
            },
          ],
          max_tokens: 1024,
        };

        const result = normalizeAnthropicRequest(request, {});

        const content = result.openai.messages[0].content;
        expect(content).toEqual([
          { type: 'text', text: 'What is in this image?' },
          { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,SGVsbG8gV29ybGQ=', detail: 'high' } },
        ]);
      });

      it('should convert base64 PNG image', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: 'iVBORw0KGgo=',
                  },
                },
              ],
            },
          ],
          max_tokens: 1024,
        };

        const result = normalizeAnthropicRequest(request, {});

        const content = result.openai.messages[0].content as Array<{ type: string; image_url: { url: string } }>;
        expect(content[0].type).toBe('image_url');
        expect(content[0].image_url.url).toBe('data:image/png;base64,iVBORw0KGgo=');
      });

      it('should convert URL image', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'url',
                    url: 'https://example.com/image.jpg',
                  },
                },
              ],
            },
          ],
          max_tokens: 1024,
        };

        const result = normalizeAnthropicRequest(request, {});

        const content = result.openai.messages[0].content as Array<{ type: string; image_url: { url: string } }>;
        expect(content[0].type).toBe('image_url');
        expect(content[0].image_url.url).toBe('https://example.com/image.jpg');
      });

      it('should convert GIF image', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/gif',
                    data: 'R0lGODlh',
                  },
                },
              ],
            },
          ],
          max_tokens: 1024,
        };

        const result = normalizeAnthropicRequest(request, {});

        const content = result.openai.messages[0].content as Array<{ type: string; image_url: { url: string } }>;
        expect(content[0].type).toBe('image_url');
        expect(content[0].image_url.url).toBe('data:image/gif;base64,R0lGODlh');
      });

      it('should convert WebP image', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/webp',
                    data: 'UklGRiQAA',
                  },
                },
              ],
            },
          ],
          max_tokens: 1024,
        };

        const result = normalizeAnthropicRequest(request, {});

        const content = result.openai.messages[0].content as Array<{ type: string; image_url: { url: string } }>;
        expect(content[0].type).toBe('image_url');
        expect(content[0].image_url.url).toBe('data:image/webp;base64,UklGRiQAA');
      });

      it('should convert WebP image', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/webp',
                    data: 'UklGRiQAA',
                  },
                },
              ],
            },
          ],
          max_tokens: 1024,
        };

        const result = normalizeAnthropicRequest(request, {});

        const content = result.openai.messages[0].content as Array<{ type: string; image_url: { url: string } }>;
        expect(content[0].image_url.url).toBe('data:image/webp;base64,UklGRiQAA');
      });
    });

    describe('temperature, top_p, stop_sequences', () => {
      it('should convert temperature', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 1024,
          temperature: 0.7,
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.temperature).toBe(0.7);
      });

      it('should convert top_p', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 1024,
          top_p: 0.9,
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.top_p).toBe(0.9);
      });

      it('should convert stop_sequences array', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 1024,
          stop_sequences: ['END', 'STOP', 'DONE'],
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.stop).toEqual(['END', 'STOP', 'DONE']);
      });

      it('should convert all sampling parameters', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 2048,
          temperature: 0.5,
          top_p: 0.8,
          stop_sequences: ['TERMINATE'],
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.temperature).toBe(0.5);
        expect(result.openai.top_p).toBe(0.8);
        expect(result.openai.stop).toEqual(['TERMINATE']);
        expect(result.openai.max_tokens).toBe(2048);
      });
    });

    describe('tools conversion', () => {
      it('should convert basic tool definition', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [{ role: 'user', content: 'Get weather for NYC' }],
          max_tokens: 1024,
          tools: [
            {
              name: 'get_weather',
              description: 'Get current weather for a location',
              input_schema: {
                type: 'object',
                properties: {
                  location: { type: 'string', description: 'City name' },
                  unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
                },
                required: ['location'],
              },
            },
          ],
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.tools).toEqual([
          {
            type: 'function',
            function: {
              name: 'get_weather',
              description: 'Get current weather for a location',
              parameters: {
                type: 'object',
                properties: {
                  location: { type: 'string', description: 'City name' },
                  unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
                },
                required: ['location'],
              },
            },
          },
        ]);
      });

      it('should convert multiple tools', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [{ role: 'user', content: 'Do something' }],
          max_tokens: 1024,
          tools: [
            { name: 'tool1', input_schema: { type: 'object' } },
            { name: 'tool2', input_schema: { type: 'object' } },
            { name: 'tool3', input_schema: { type: 'object' } },
          ],
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.tools).toHaveLength(3);
      });

      it('should handle empty tools array', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 1024,
          tools: [],
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.tools).toBeUndefined();
      });
    });

    describe('tool_choice conversion', () => {
      it('should convert tool_choice auto', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 1024,
          tool_choice: { type: 'auto' },
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.tool_choice).toBe('auto');
      });

      it('should convert tool_choice any to required', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 1024,
          tool_choice: { type: 'any' },
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.tool_choice).toBe('required');
      });

      it('should convert tool_choice with specific tool', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 1024,
          tool_choice: { type: 'tool', name: 'get_weather' },
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.tool_choice).toEqual({
          type: 'function',
          function: { name: 'get_weather' },
        });
      });
    });

    describe('tool_use in messages', () => {
      it('should convert assistant message with tool_use', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [
            { role: 'user', content: 'What is the weather?' },
            {
              role: 'assistant',
              content: [
                { type: 'text', text: 'Let me check that for you.' },
                {
                  type: 'tool_use',
                  id: 'toolu_abc123',
                  name: 'get_weather',
                  input: { location: 'New York' },
                },
              ],
            },
          ],
          max_tokens: 1024,
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.messages[1]).toEqual({
          role: 'assistant',
          content: 'Let me check that for you.',
          tool_calls: [
            {
              id: 'toolu_abc123',
              type: 'function',
              function: {
                name: 'get_weather',
                arguments: JSON.stringify({ location: 'New York' }),
              },
            },
          ],
        });
      });

      it('should handle tool_use without text', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [
            { role: 'user', content: 'What is the weather?' },
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  id: 'toolu_abc123',
                  name: 'get_weather',
                  input: { location: 'New York' },
                },
              ],
            },
          ],
          max_tokens: 1024,
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.messages[1].content).toBeUndefined();
        expect(result.openai.messages[1].tool_calls).toHaveLength(1);
        expect(result.openai.messages[1].tool_calls?.[0].function.name).toBe('get_weather');
      });
    });

    describe('realistic Claude Code scenarios', () => {
      it('should convert multi-turn conversation', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi! How can I help you?' },
            { role: 'user', content: 'Write a function to add two numbers' },
          ],
          max_tokens: 1024,
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.messages).toHaveLength(3);
        expect(result.openai.messages[0].role).toBe('user');
        expect(result.openai.messages[1].role).toBe('assistant');
        expect(result.openai.messages[2].role).toBe('user');
      });

      it('should convert request with code execution context', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Analyze this code and explain what it does:',
                },
                {
                  type: 'text',
                  text: '```python\ndef add(a, b):\n    return a + b\n```',
                },
              ],
            },
          ],
          max_tokens: 1024,
        };

        const result = normalizeAnthropicRequest(request, {});

        // Multiple text blocks get flattened to a single string
        expect(result.openai.messages[0].content).toBe(
          'Analyze this code and explain what it does:\n```python\ndef add(a, b):\n    return a + b\n```'
        );
      });

      it('should convert vision request with screenshot', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'What do you see in this screenshot?',
                },
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/png',
                    data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                  },
                },
              ],
            },
          ],
          max_tokens: 1024,
        };

        const result = normalizeAnthropicRequest(request, {});

        const content = result.openai.messages[0].content as Array<{ type: string }>;
        expect(content).toHaveLength(2);
        expect(content[1].type).toBe('image_url');
      });

      it('should convert tool-using conversation', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [
            { role: 'user', content: 'What files are in the current directory?' },
            {
              role: 'assistant',
              content: [
                {
                  type: 'tool_use',
                  id: 'toolu_001',
                  name: 'bash',
                  input: { command: 'ls -la' },
                },
              ],
            },
            {
              role: 'user',
              content: [
                {
                  type: 'tool_result',
                  tool_use_id: 'toolu_001',
                  content:
                    'total 32\ndrwxr-xr-x   5 user  staff  160 Mar 14 10:00 .\ndrwxr-xr-x   3 user  staff   96 Mar 14 09:00 ..',
                },
              ],
            },
          ],
          max_tokens: 1024,
          tools: [
            {
              name: 'bash',
              description: 'Run a bash command',
              input_schema: {
                type: 'object',
                properties: {
                  command: { type: 'string' },
                },
                required: ['command'],
              },
            },
          ],
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.messages).toHaveLength(3);
        expect(result.openai.messages[1].tool_calls).toHaveLength(1);
        // In OpenAI, tool results have role 'tool'
        expect(result.openai.messages[2].role).toBe('tool');
        expect((result.openai.messages[2] as { tool_call_id?: string }).tool_call_id).toBe('toolu_001');
      });
    });

    describe('streaming', () => {
      it('should pass through stream flag', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 1024,
          stream: true,
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.stream).toBe(true);
      });

      it('should pass through stream_options', () => {
        const request = {
          model: 'claude-3-5-sonnet-20240620',
          messages: [{ role: 'user', content: 'Hello' }],
          max_tokens: 1024,
          stream: true,
          stream_options: { include_usage: true },
        };

        const result = normalizeAnthropicRequest(request, {});

        expect(result.openai.stream).toBe(true);
        expect(result.openai.stream_options).toEqual({ include_usage: true });
      });
    });
  });

  describe('denormalizeOpenAIResponse', () => {
    it('should convert simple text response', () => {
      const openaiResponse = {
        id: 'chatcmpl-abc123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Hello! How can I help you?' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
      };

      const result = denormalizeOpenAIResponse(openaiResponse, 'claude-3-5-sonnet-20240620');

      expect(result.id).toBe('msg_chatcmpl-abc123');
      expect(result.type).toBe('message');
      expect(result.role).toBe('assistant');
      expect(result.content).toEqual([{ type: 'text', text: 'Hello! How can I help you?' }]);
      expect(result.stop_reason).toBe('end_turn');
      expect(result.usage).toEqual({ input_tokens: 10, output_tokens: 8 });
    });

    it('should convert tool_call response', () => {
      const openaiResponse = {
        id: 'chatcmpl-abc123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_abc123',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{"location":"New York"}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 50, completion_tokens: 20, total_tokens: 70 },
      };

      const result = denormalizeOpenAIResponse(openaiResponse, 'claude-3-5-sonnet-20240620');

      expect(result.content).toHaveLength(1);
      expect(result.content[0]).toEqual({
        type: 'tool_use',
        id: 'call_abc123',
        name: 'get_weather',
        input: { location: 'New York' },
      });
      expect(result.stop_reason).toBe('tool_use');
    });

    it('should map finish_reason correctly', () => {
      const stopResponse = {
        id: 'chatcmpl-1',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [{ index: 0, message: { role: 'assistant', content: 'Done' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      const lengthResponse = {
        ...stopResponse,
        id: 'chatcmpl-2',
        choices: [{ ...stopResponse.choices[0], finish_reason: 'length' }],
      };

      expect(denormalizeOpenAIResponse(stopResponse, 'test').stop_reason).toBe('end_turn');
      expect(denormalizeOpenAIResponse(lengthResponse, 'test').stop_reason).toBe('max_tokens');
    });

    it('should handle null content', () => {
      const openaiResponse = {
        id: 'chatcmpl-null',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: null },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
      };

      const result = denormalizeOpenAIResponse(openaiResponse, 'test');

      expect(result.content).toEqual([]);
    });

    it('should handle response with both text and tool_calls', () => {
      const openaiResponse = {
        id: 'chatcmpl-mixed',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'I will check the weather for you.',
              tool_calls: [
                {
                  id: 'call_123',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{"city":"London"}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 30, completion_tokens: 25, total_tokens: 55 },
      };

      const result = denormalizeOpenAIResponse(openaiResponse, 'test');

      expect(result.content).toHaveLength(2);
      expect(result.content[0]).toEqual({
        type: 'text',
        text: 'I will check the weather for you.',
      });
      expect(result.content[1]).toEqual({
        type: 'tool_use',
        id: 'call_123',
        name: 'get_weather',
        input: { city: 'London' },
      });
    });

    it('should handle multiple tool_calls', () => {
      const openaiResponse = {
        id: 'chatcmpl-multi',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_1',
                  type: 'function',
                  function: { name: 'get_weather', arguments: '{"city":"NYC"}' },
                },
                {
                  id: 'call_2',
                  type: 'function',
                  function: { name: 'get_time', arguments: '{"timezone":"EST"}' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 40, completion_tokens: 30, total_tokens: 70 },
      };

      const result = denormalizeOpenAIResponse(openaiResponse, 'test');

      expect(result.content).toHaveLength(2);
      expect(result.content[0]).toEqual({
        type: 'tool_use',
        id: 'call_1',
        name: 'get_weather',
        input: { city: 'NYC' },
      });
      expect(result.content[1]).toEqual({
        type: 'tool_use',
        id: 'call_2',
        name: 'get_time',
        input: { timezone: 'EST' },
      });
    });

    it('should handle malformed JSON in tool_call arguments', () => {
      const openaiResponse = {
        id: 'chatcmpl-malformed',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_bad',
                  type: 'function',
                  function: { name: 'bad_json', arguments: 'not valid json{' },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      };

      const result = denormalizeOpenAIResponse(openaiResponse, 'test');

      expect(result.content[0]).toEqual({
        type: 'tool_use',
        id: 'call_bad',
        name: 'bad_json',
        input: { _raw: 'not valid json{' },
      });
    });

    it('should handle content_filter finish_reason', () => {
      const openaiResponse = {
        id: 'chatcmpl-filtered',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: '' },
            finish_reason: 'content_filter',
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
      };

      const result = denormalizeOpenAIResponse(openaiResponse, 'test');

      expect(result.stop_reason).toBe('end_turn');
    });

    it('should preserve original model name', () => {
      const openaiResponse = {
        id: 'chatcmpl-model',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'Test' },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 },
      };

      const result = denormalizeOpenAIResponse(openaiResponse, 'claude-3-5-sonnet-20241022');

      expect(result.model).toBe('claude-3-5-sonnet-20241022');
    });

    it('should handle empty choices array', () => {
      const openaiResponse = {
        id: 'chatcmpl-empty',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      };

      const result = denormalizeOpenAIResponse(openaiResponse, 'test');

      expect(result.content).toEqual([]);
      expect(result.stop_reason).toBe('end_turn');
      expect(result.usage).toEqual({ input_tokens: 0, output_tokens: 0 });
    });

    it('should handle tool_call with complex nested arguments', () => {
      const openaiResponse = {
        id: 'chatcmpl-complex',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: null,
              tool_calls: [
                {
                  id: 'call_complex',
                  type: 'function',
                  function: {
                    name: 'create_user',
                    arguments: JSON.stringify({
                      name: 'John Doe',
                      email: 'john@example.com',
                      profile: {
                        age: 30,
                        address: {
                          city: 'NYC',
                          country: 'USA',
                        },
                      },
                      roles: ['admin', 'user'],
                    }),
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
        usage: { prompt_tokens: 60, completion_tokens: 40, total_tokens: 100 },
      };

      const result = denormalizeOpenAIResponse(openaiResponse, 'test');

      expect(result.content[0]).toEqual({
        type: 'tool_use',
        id: 'call_complex',
        name: 'create_user',
        input: {
          name: 'John Doe',
          email: 'john@example.com',
          profile: {
            age: 30,
            address: {
              city: 'NYC',
              country: 'USA',
            },
          },
          roles: ['admin', 'user'],
        },
      });
    });

    it('should handle multi-line text content', () => {
      const openaiResponse = {
        id: 'chatcmpl-multiline',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4o',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Line 1\nLine 2\nLine 3\n\nParagraph 2',
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 15, completion_tokens: 12, total_tokens: 27 },
      };

      const result = denormalizeOpenAIResponse(openaiResponse, 'test');

      expect(result.content[0]).toEqual({
        type: 'text',
        text: 'Line 1\nLine 2\nLine 3\n\nParagraph 2',
      });
    });
  });

  describe('convertToolResult', () => {
    describe('convertToolResultToAnthropic', () => {
      it('should convert string result', () => {
        const result = convertToolResultToAnthropic('toolu_123', 'Sunny, 72°F');

        expect(result).toEqual({
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'toolu_123',
              content: 'Sunny, 72°F',
            },
          ],
        });
      });

      it('should convert object result', () => {
        const result = convertToolResultToAnthropic('toolu_123', { temperature: 72, conditions: 'sunny' });

        expect(result.content[0].content).toBe('{"temperature":72,"conditions":"sunny"}');
      });

      it('should handle error flag', () => {
        const result = convertToolResultToAnthropic('toolu_123', 'Error occurred', true);

        expect(result.content[0].is_error).toBe(true);
      });
    });

    describe('convertToolResultToOpenAI', () => {
      it('should convert string result', () => {
        const result = convertToolResultToOpenAI('call_123', 'Sunny, 72°F');

        expect(result).toEqual({
          role: 'tool',
          content: 'Sunny, 72°F',
          tool_call_id: 'call_123',
        });
      });

      it('should convert object result', () => {
        const result = convertToolResultToOpenAI('call_123', { temperature: 72 });

        expect(result.content).toBe('{"temperature":72}');
      });
    });
  });
});
