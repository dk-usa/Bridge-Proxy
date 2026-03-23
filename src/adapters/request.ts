import type {
  AnthropicMessageRequest,
  AnthropicMessageResponse,
  AnthropicMessageParam,
  AnthropicContentBlockParam,
  AnthropicTool,
  AnthropicToolChoice,
  AnthropicSystemPrompt,
} from '../schemas/anthropic.js';
import type {
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResponse,
  OpenAIMessageParam,
  OpenAITool,
  OpenAIToolChoice,
  OpenAIMessageContent,
} from '../schemas/openai.js';

export interface NormalizedRequest {
  openai: OpenAIChatCompletionRequest;
  modelMapping: Record<string, string>;
}

export function normalizeAnthropicRequest(
  request: AnthropicMessageRequest,
  modelMapping: Record<string, string>
): NormalizedRequest {
  const mappedModel = modelMapping[request.model] ?? request.model;

  const openAIRequest: OpenAIChatCompletionRequest = {
    model: mappedModel,
    messages: convertAnthropicMessagesToOpenAI(request.messages, request.tools),
    max_tokens: request.max_tokens,
    temperature: request.temperature,
    top_p: request.top_p,
    stop: request.stop_sequences,
    stream: request.stream,
    stream_options: request.stream_options,
    tools: convertAnthropicToolsToOpenAI(request.tools),
    tool_choice: convertAnthropicToolChoiceToOpenAI(request.tool_choice),
  };

  if (request.metadata && Object.keys(request.metadata).length > 0) {
    openAIRequest.metadata = request.metadata;
  }

  if (request.system) {
    const systemContent = convertAnthropicSystemToString(request.system);
    openAIRequest.messages.unshift({
      role: 'system',
      content: systemContent,
    });
  }

  return {
    openai: openAIRequest,
    modelMapping,
  };
}

function convertAnthropicSystemToString(system: AnthropicSystemPrompt): string {
  if (typeof system === 'string') {
    return system;
  }

  return system.map((block) => block.text).join('\n');
}

function convertAnthropicMessagesToOpenAI(
  messages: AnthropicMessageParam[],
  tools?: AnthropicTool[]
): OpenAIMessageParam[] {
  const converted: OpenAIMessageParam[] = [];

  for (const msg of messages) {
    // Handle tool_result in user messages - returns array
    if (msg.role === 'user' && Array.isArray(msg.content)) {
      const toolResultBlocks = msg.content.filter(
        (block) =>
          typeof block === 'object' &&
          block !== null &&
          (block as Record<string, unknown>).type === 'tool_result'
      );

      if (toolResultBlocks.length > 0) {
        const toolMessages = convertToolResultsToOpenAI(msg.content);
        converted.push(...toolMessages);
        continue;
      }
    }

    const openaiMsg = convertAnthropicMessageToOpenAI(msg, tools);
    if (openaiMsg) {
      converted.push(openaiMsg);
    }
  }

  return converted;
}

function convertAnthropicMessageToOpenAI(
  msg: AnthropicMessageParam,
  _tools?: AnthropicTool[]
): OpenAIMessageParam | null {
  const role = msg.role === 'assistant' ? 'assistant' : 'user';

  if (msg.role === 'assistant' && Array.isArray(msg.content)) {
    const hasToolUse = msg.content.some(
      (block) =>
        typeof block === 'object' &&
        block !== null &&
        (block as Record<string, unknown>).type === 'tool_use'
    );

    if (hasToolUse) {
      return convertAnthropicAssistantWithToolsToOpenAI(msg);
    }
  }

  const content = convertAnthropicContentToOpenAI(msg.content);

  return {
    role,
    content,
  };
}

function convertAnthropicAssistantWithToolsToOpenAI(
  msg: AnthropicMessageParam
): OpenAIMessageParam {
  const toolCalls: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }> = [];
  let textContent = '';

  const contentBlocks = Array.isArray(msg.content) ? msg.content : [msg.content];

  for (const block of contentBlocks) {
    if (typeof block === 'string') {
      textContent += block;
    } else if (block && typeof block === 'object') {
      const b = block as Record<string, unknown>;

      if (b.type === 'text') {
        textContent += b.text as string;
      } else if (b.type === 'tool_use') {
        const toolUse = b as {
          id: string;
          name: string;
          input: Record<string, unknown>;
        };

        toolCalls.push({
          id: toolUse.id,
          type: 'function',
          function: {
            name: toolUse.name,
            arguments: JSON.stringify(toolUse.input),
          },
        });
      }
    }
  }

  const result: OpenAIMessageParam = {
    role: 'assistant',
    content: textContent || undefined,
  };

  if (toolCalls.length > 0) {
    result.tool_calls = toolCalls;
  }

  return result;
}

function convertToolResultsToOpenAI(content: AnthropicContentBlockParam[]): OpenAIMessageParam[] {
  const toolResults = content.filter(
    (block) =>
      typeof block === 'object' &&
      block !== null &&
      (block as Record<string, unknown>).type === 'tool_result'
  ) as Array<{
    type: 'tool_result';
    tool_use_id: string;
    content: string | Array<unknown>;
    is_error?: boolean;
  }>;

  // Return each tool result as a separate message to preserve tool_call_id mapping
  return toolResults.map((result) => {
    const resultContent =
      typeof result.content === 'string' ? result.content : JSON.stringify(result.content);

    return {
      role: 'tool' as const,
      content: resultContent,
      tool_call_id: result.tool_use_id,
    };
  });
}

function convertAnthropicContentToOpenAI(
  content: AnthropicMessageParam['content']
): OpenAIMessageContent {
  if (typeof content === 'string') {
    return content;
  }

  if (!Array.isArray(content)) {
    return String(content);
  }

  const parts: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }
  > = [];

  for (const block of content) {
    const converted = convertAnthropicContentBlockToOpenAI(block);
    if (converted) {
      parts.push(converted);
    }
  }

  if (parts.length === 0) {
    return ' ';
  }

  // If all parts are text, flatten to a single string
  const allText = parts.every((p) => p.type === 'text');
  if (allText) {
    return parts.map((p) => (p as { type: 'text'; text: string }).text).join('\n');
  }

  return parts;
}

function convertAnthropicContentBlockToOpenAI(
  block: AnthropicContentBlockParam
):
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }
  | null {
  if (typeof block === 'string') {
    return { type: 'text', text: block };
  }

  if (!block || typeof block !== 'object') {
    return null;
  }

  const b = block as Record<string, unknown>;

  if (b.type === 'text') {
    return { type: 'text', text: b.text as string };
  }

  if (b.type === 'image') {
    return convertAnthropicImageToOpenAI(b);
  }

  return null;
}

function convertAnthropicImageToOpenAI(
  imageBlock: Record<string, unknown>
): { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } } | null {
  const source = imageBlock.source as Record<string, unknown> | undefined;
  if (!source) return null;

  const sourceType = source.type as string;
  const mediaType = source.media_type as string | undefined;
  const data = source.data as string | undefined;
  const url = source.url as string | undefined;

  if (sourceType === 'base64' && data) {
    const mimeType = mediaType || 'image/jpeg';
    return {
      type: 'image_url',
      image_url: {
        url: `data:${mimeType};base64,${data}`,
        detail: 'high',
      },
    };
  }

  if (sourceType === 'url' && url) {
    return {
      type: 'image_url',
      image_url: {
        url,
        detail: 'high',
      },
    };
  }

  return null;
}

function convertAnthropicToolsToOpenAI(
  tools?: AnthropicTool[]
): OpenAIChatCompletionRequest['tools'] {
  if (!tools || tools.length === 0) return undefined;

  return tools.map(
    (tool): OpenAITool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema,
      },
    })
  );
}

function convertAnthropicToolChoiceToOpenAI(
  choice?: AnthropicToolChoice
): OpenAIToolChoice | undefined {
  if (!choice) return undefined;

  switch (choice.type) {
    case 'auto':
      return 'auto';
    case 'any':
      return 'required';
    case 'tool':
      return {
        type: 'function',
        function: {
          name: choice.name,
        },
      };
    default:
      return undefined;
  }
}

export function denormalizeOpenAIResponse(
  response: OpenAIChatCompletionResponse,
  originalModel: string
): AnthropicMessageResponse {
  const firstChoice = response.choices?.[0];

  if (!firstChoice || !firstChoice.message) {
    return {
      id: `msg_${response.id}`,
      type: 'message',
      role: 'assistant',
      content: [],
      model: originalModel,
      stop_reason: 'end_turn',
      usage: {
        input_tokens: response.usage?.prompt_tokens ?? 0,
        output_tokens: response.usage?.completion_tokens ?? 0,
      },
    };
  }

  const message = firstChoice.message;

  const content: AnthropicMessageResponse['content'] = [];

  if (message?.content !== null && message?.content !== undefined) {
    const textContent = String(message.content);
    if (textContent) {
      content.push({
        type: 'text',
        text: textContent,
      });
    }
  }

  if (message?.tool_calls) {
    for (const tc of message.tool_calls) {
      let input: Record<string, unknown> = {};
      try {
        input = JSON.parse(tc.function.arguments);
      } catch {
        input = { _raw: tc.function.arguments };
      }

      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.function.name,
        input,
      });
    }
  }

  const finishReasonMap: Record<string, AnthropicMessageResponse['stop_reason']> = {
    stop: 'end_turn',
    length: 'max_tokens',
    tool_calls: 'tool_use',
  };

  return {
    id: `msg_${response.id}`,
    type: 'message',
    role: 'assistant',
    content,
    model: originalModel,
    stop_reason: finishReasonMap[response.choices[0]?.finish_reason ?? ''] ?? 'end_turn',
    usage: {
      input_tokens: response.usage?.prompt_tokens ?? 0,
      output_tokens: response.usage?.completion_tokens ?? 0,
    },
  };
}

export function convertToolResultToAnthropic(
  toolCallId: string,
  result: string | Record<string, unknown>,
  isError?: boolean
): {
  role: 'user';
  content: Array<{ type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }>;
} {
  const content = typeof result === 'string' ? result : JSON.stringify(result);

  return {
    role: 'user',
    content: [
      {
        type: 'tool_result',
        tool_use_id: toolCallId,
        content,
        is_error: isError,
      },
    ],
  };
}

export function convertToolResultToOpenAI(
  toolCallId: string,
  result: string | Record<string, unknown>
): OpenAIMessageParam {
  const content = typeof result === 'string' ? result : JSON.stringify(result);

  return {
    role: 'tool',
    content,
    tool_call_id: toolCallId,
  };
}

export function convertToProviderRequest(
  request: AnthropicMessageRequest,
  providerModel: string
): OpenAIChatCompletionRequest {
  const openAIRequest: OpenAIChatCompletionRequest = {
    model: providerModel,
    messages: convertAnthropicMessagesToOpenAI(request.messages, request.tools),
    max_tokens: request.max_tokens,
    temperature: request.temperature,
    top_p: request.top_p,
    stop: request.stop_sequences,
    stream: request.stream,
    stream_options: request.stream_options,
    tools: convertAnthropicToolsToOpenAI(request.tools),
    tool_choice: convertAnthropicToolChoiceToOpenAI(request.tool_choice),
  };

  if (request.metadata && Object.keys(request.metadata).length > 0) {
    openAIRequest.metadata = request.metadata;
  }

  if (request.system) {
    const systemContent = convertAnthropicSystemToString(request.system);
    openAIRequest.messages.unshift({
      role: 'system',
      content: systemContent,
    });
  }

  return openAIRequest;
}

export function convertFromProviderResponse(
  response: OpenAIChatCompletionResponse,
  originalModel: string
): AnthropicMessageResponse {
  return denormalizeOpenAIResponse(response, originalModel);
}

export function convertOpenAIStreamChunkToAnthropic(
  line: string,
  _messageId: string,
  _model: string
): string | null {
  if (!line.startsWith('data: ')) {
    return null;
  }

  const data = line.slice(6);

  if (data === '[DONE]') {
    return null;
  }

  try {
    const chunk = JSON.parse(data);

    if (chunk.object !== 'chat.completion.chunk') {
      return null;
    }

    const delta = chunk.choices?.[0]?.delta;
    const finishReason = chunk.choices?.[0]?.finish_reason;

    const anthropicChunk: Record<string, unknown> = {
      type: 'content_block_delta',
      delta: {},
      usage: {
        input_tokens: 0,
        output_tokens: 0,
      },
    };

    if (delta?.content) {
      anthropicChunk.delta = {
        type: 'text_delta',
        text: delta.content,
      };
    }

    if (finishReason === 'stop') {
      return `event: message_delta\ndata: ${JSON.stringify({
        type: 'message_delta',
        delta: {},
        usage: {
          output_tokens: chunk.usage?.completion_tokens ?? 0,
        },
        stop_reason: 'end_turn',
      })}\n\n`;
    }

    if (delta?.content) {
      return `event: content_block_delta\ndata: ${JSON.stringify(anthropicChunk)}\n\n`;
    }

    return null;
  } catch {
    return null;
  }
}
