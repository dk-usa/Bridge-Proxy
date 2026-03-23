import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getConfig } from '../config/index.js';
import { adminStore } from '../admin-store.js';
import { normalizeAnthropicRequest, denormalizeOpenAIResponse } from '../adapters/request.js';
import { AnthropicMessageRequestSchema } from '../schemas/anthropic.js';
import type { OpenAIChatCompletionResponse } from '../schemas/openai.js';

const TranslateRequestSchema = z.object({
  request: z.unknown(),
});

const _ReplayRequestSchema = z.object({
  provider: z.enum(['primary', 'fallback']).optional(),
});

export async function debugRouter(fastify: FastifyInstance): Promise<void> {
  fastify.post('/translate', async (request, reply) => {
    const result = TranslateRequestSchema.safeParse(request.body);
    if (!result.success) {
      return reply.status(400).send({
        error: 'Invalid request body',
        details: result.error.errors,
      });
    }

    const config = getConfig();
    const anthropicRequest = result.data.request;

    const parsed = AnthropicMessageRequestSchema.safeParse(anthropicRequest);
    if (!parsed.success) {
      return reply.status(400).send({
        error: 'Invalid Anthropic request format',
        details: parsed.error.errors,
      });
    }

    const normalized = normalizeAnthropicRequest(parsed.data, config.modelMapping);

    return {
      anthropic_request: parsed.data,
      model_mapping: normalized.modelMapping,
      mapped_model: normalized.openai.model,
      normalized_request: {
        model: normalized.openai.model,
        messages: normalized.openai.messages,
        max_tokens: normalized.openai.max_tokens,
        temperature: normalized.openai.temperature,
        top_p: normalized.openai.top_p,
        stop: normalized.openai.stop,
        tools: normalized.openai.tools,
        tool_choice: normalized.openai.tool_choice,
        stream: normalized.openai.stream,
        stream_options: normalized.openai.stream_options,
        metadata: normalized.openai.metadata,
      },
    };
  });

  fastify.post<{ Params: { id: string }; Body: z.infer<typeof _ReplayRequestSchema> }>(
    '/replay/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { provider } = request.body ?? {};

      const log = adminStore.getLogById(id);
      if (!log) {
        return reply.status(404).send({
          error: 'Log not found',
        });
      }

      if (!log.openaiRequest) {
        return reply.status(400).send({
          error: 'Log does not contain OpenAI request data',
        });
      }

      const config = getConfig();
      const providerConfig =
        provider === 'fallback' ? config.providers.fallback : config.providers.primary;

      if (!providerConfig?.baseUrl) {
        return reply.status(400).send({
          error: 'Provider not configured',
        });
      }

      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), providerConfig.timeout ?? 60000);

        const response = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(providerConfig.apiKey ? { Authorization: `Bearer ${providerConfig.apiKey}` } : {}),
          },
          body: JSON.stringify({
            ...log.openaiRequest,
            stream: false,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
          const errorText = await response.text();
          return reply.status(response.status).send({
            error: 'Provider request failed',
            status: response.status,
            statusText: response.statusText,
            body: errorText,
          });
        }

        const openaiResponse = (await response.json()) as OpenAIChatCompletionResponse;

        const anthropicResponse = denormalizeOpenAIResponse(
          openaiResponse,
          (log.anthropicRequest as { model?: string })?.model ?? 'unknown'
        );

        return {
          success: true,
          provider: provider ?? 'primary',
          openai_request: log.openaiRequest,
          openai_response: openaiResponse,
          anthropic_response: anthropicResponse,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return reply.status(500).send({
          error: 'Replay failed',
          message: errorMessage,
        });
      }
    }
  );
}
