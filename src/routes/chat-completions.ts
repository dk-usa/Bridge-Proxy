import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { classifyError } from '../providers/errors.js';
import { adminStore } from '../admin-store.js';
import { apiKeyService } from '../services/api-key.js';
import { generateRequestId } from '../utils/id.js';
import type { OpenAIChatCompletionResponse } from '../schemas/openai.js';

const ChatCompletionMessageSchema = z.object({
  role: z.enum(['system', 'user', 'assistant', 'function', 'tool']),
  content: z.union([z.string(), z.null(), z.array(z.unknown())]),
  name: z.string().optional(),
  function_call: z
    .object({
      name: z.string(),
      arguments: z.string(),
    })
    .optional(),
  tool_call_id: z.string().optional(),
  tool_calls: z
    .array(
      z.object({
        id: z.string(),
        type: z.literal('function'),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      })
    )
    .optional(),
});

const ChatCompletionRequestSchema = z.object({
  model: z.string(),
  messages: z.array(ChatCompletionMessageSchema),
  temperature: z.number().optional(),
  top_p: z.number().optional(),
  max_tokens: z.number().optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  stream: z.boolean().optional(),
  functions: z.unknown().optional(),
  function_call: z.unknown().optional(),
  tools: z.unknown().optional(),
  tool_choice: z.unknown().optional(),
  frequency_penalty: z.number().optional(),
  presence_penalty: z.number().optional(),
  n: z.number().optional(),
});

export async function chatCompletionsRouter(fastify: FastifyInstance): Promise<void> {
  fastify.post<{ Body: unknown }>(
    '/chat/completions',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const requestId = generateRequestId();
      const startTime = Date.now();

      const apiKey =
        (request.headers['authorization'] as string)?.replace('Bearer ', '') ||
        (request.headers['x-api-key'] as string);

      if (apiKey) {
        const validKey = apiKeyService.validateKey(apiKey);
        if (!validKey) {
          return reply.status(401).send({
            error: {
              message: 'Invalid API key',
              type: 'invalid_request_error',
            },
          });
        }
      }

      const parseResult = ChatCompletionRequestSchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            message: parseResult.error.errors.map((e) => e.message).join(', '),
            type: 'invalid_request_error',
          },
        });
      }

      const { model, messages, temperature, top_p, max_tokens, stop, stream, tools, tool_choice } =
        parseResult.data;

      const mapping = adminStore.resolveModel(model);
      const providerId = mapping?.providerId || 'primary';
      const provider = adminStore.getProviderById(providerId);

      if (!provider) {
        return reply.status(500).send({
          error: {
            message: 'Provider not found',
            type: 'internal_error',
          },
        });
      }

      try {
        const baseUrl = provider.baseUrl.replace(/\/v1\/?$/, '');
        const endpoint = `${baseUrl}/v1/chat/completions`;

        const normalizedMessages = messages.map((m) => ({
          role: m.role,
          content: m.content ?? '',
          name: m.name,
          function_call: m.function_call,
          tool_call_id: m.tool_call_id,
          tool_calls: m.tool_calls,
        }));

        const openAIRequest: Record<string, unknown> = {
          model: mapping?.providerModel || model,
          messages: normalizedMessages,
          temperature,
          top_p,
          max_tokens,
          stop: stop ? (Array.isArray(stop) ? stop : [stop]) : undefined,
          stream: stream || false,
          tools: tools as unknown,
          tool_choice: tool_choice as unknown,
        };

        const providerResponse = await callProvider(
          endpoint,
          provider.apiKey,
          openAIRequest,
          provider.timeoutMs
        );

        const duration = Date.now() - startTime;

        if (stream) {
          reply.raw.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Request-ID': requestId,
          });

          if (providerResponse instanceof ReadableStream) {
            const reader = providerResponse.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                  if (line.trim() && line.startsWith('data:')) {
                    reply.raw.write(line + '\n');
                  }
                }
              }

              if (buffer.trim()) {
                reply.raw.write(buffer + '\n');
              }
            } catch {
              // Stream ended
            }
          }

          reply.raw.write('data: [DONE]\n\n');
          reply.raw.end();

          adminStore.addLog({
            id: requestId,
            timestamp: new Date().toISOString(),
            method: 'POST',
            url: '/v1/chat/completions',
            statusCode: 200,
            model,
            provider: providerId,
            latencyMs: duration,
            status: 'success',
          });

          return;
        }

        const data = providerResponse as OpenAIChatCompletionResponse;

        adminStore.addLog({
          id: requestId,
          timestamp: new Date().toISOString(),
          method: 'POST',
          url: '/v1/chat/completions',
          statusCode: 200,
          model,
          provider: providerId,
          latencyMs: duration,
          status: 'success',
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
          totalTokens: data.usage?.total_tokens || 0,
        });

        return reply.status(200).send(data);
      } catch (error) {
        const duration = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const classified = classifyError(error, providerId);

        adminStore.addLog({
          id: requestId,
          timestamp: new Date().toISOString(),
          method: 'POST',
          url: '/v1/chat/completions',
          statusCode: classified.statusCode || 500,
          model,
          provider: providerId,
          latencyMs: duration,
          status: 'error',
          error: errorMessage,
        });

        return reply.status(classified.statusCode || 500).send({
          error: {
            message: errorMessage,
            type: classified.type === 'RATE_LIMIT' ? 'rate_limit_error' : 'internal_error',
          },
        });
      }
    }
  );
}

async function callProvider(
  url: string,
  apiKey: string,
  body: unknown,
  timeoutMs: number
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Provider request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return response.body || response.json();
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}
