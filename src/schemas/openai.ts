import { z } from 'zod';

export const OPENAI_MESSAGE_ROLES = {
  SYSTEM: 'system',
  USER: 'user',
  ASSISTANT: 'assistant',
  DEVELOPER: 'developer',
} as const;

export type OpenAIMessageRole = (typeof OPENAI_MESSAGE_ROLES)[keyof typeof OPENAI_MESSAGE_ROLES];

export const OPENAI_TOOL_ROLE = 'tool' as const;

export const OPENAI_CONTENT_PART_TYPES = {
  TEXT: 'text',
  IMAGE_URL: 'image_url',
} as const;

export type OpenAIContentPartType =
  (typeof OPENAI_CONTENT_PART_TYPES)[keyof typeof OPENAI_CONTENT_PART_TYPES];

export const OPENAI_IMAGE_DETAIL = {
  LOW: 'low',
  HIGH: 'high',
  AUTO: 'auto',
} as const;

export type OpenAIImageDetail = (typeof OPENAI_IMAGE_DETAIL)[keyof typeof OPENAI_IMAGE_DETAIL];

export const OPENAI_TOOL_TYPES = {
  FUNCTION: 'function',
} as const;

export type OpenAIToolType = (typeof OPENAI_TOOL_TYPES)[keyof typeof OPENAI_TOOL_TYPES];

export const OPENAI_TOOL_CHOICE_TYPES = {
  NONE: 'none',
  AUTO: 'auto',
  REQUIRED: 'required',
} as const;

export type OpenAIToolChoiceType =
  (typeof OPENAI_TOOL_CHOICE_TYPES)[keyof typeof OPENAI_TOOL_CHOICE_TYPES];

export const OPENAI_FINISH_REASONS = {
  STOP: 'stop',
  LENGTH: 'length',
  CONTENT_FILTER: 'content_filter',
  TOOL_CALLS: 'tool_calls',
} as const;

export type OpenAIFinishReason = (typeof OPENAI_FINISH_REASONS)[keyof typeof OPENAI_FINISH_REASONS];

export const OPENAI_ERROR_TYPES = {
  INVALID_REQUEST: 'invalid_request_error',
  AUTHENTICATION: 'authentication_error',
  PERMISSION: 'permission_error',
  NOT_FOUND: 'not_found_error',
  RATE_LIMIT: 'rate_limit_error',
  INTERNAL: 'internal_error',
  SERVER_ERROR: 'server_error',
} as const;

export type OpenAIErrorType = (typeof OPENAI_ERROR_TYPES)[keyof typeof OPENAI_ERROR_TYPES];

export const OpenAIImageUrlSchema = z.object({
  url: z.string(),
  detail: z
    .enum([OPENAI_IMAGE_DETAIL.LOW, OPENAI_IMAGE_DETAIL.HIGH, OPENAI_IMAGE_DETAIL.AUTO])
    .optional(),
});

export type OpenAIImageUrl = z.infer<typeof OpenAIImageUrlSchema>;

export const OpenAIContentPartTextSchema = z.object({
  type: z.literal(OPENAI_CONTENT_PART_TYPES.TEXT),
  text: z.string(),
});

export type OpenAIContentPartText = z.infer<typeof OpenAIContentPartTextSchema>;

export const OpenAIContentPartImageUrlSchema = z.object({
  type: z.literal(OPENAI_CONTENT_PART_TYPES.IMAGE_URL),
  image_url: OpenAIImageUrlSchema,
});

export type OpenAIContentPartImageUrl = z.infer<typeof OpenAIContentPartImageUrlSchema>;

export const OpenAIContentPartSchema = z.union([
  OpenAIContentPartTextSchema,
  OpenAIContentPartImageUrlSchema,
]);

export type OpenAIContentPart = z.infer<typeof OpenAIContentPartSchema>;

export const OpenAIMessageContentSchema = z.union([z.string(), z.array(OpenAIContentPartSchema)]);

export type OpenAIMessageContent = z.infer<typeof OpenAIMessageContentSchema>;

export const OpenAIFunctionCallSchema = z.object({
  name: z.string(),
  arguments: z.string(),
});

export type OpenAIFunctionCall = z.infer<typeof OpenAIFunctionCallSchema>;

export const OpenAIToolCallSchema = z.object({
  id: z.string(),
  type: z.literal(OPENAI_TOOL_TYPES.FUNCTION),
  function: OpenAIFunctionCallSchema,
});

export type OpenAIToolCall = z.infer<typeof OpenAIToolCallSchema>;

export const OpenAIMessageParamBaseSchema = z.object({
  role: z.enum([
    OPENAI_MESSAGE_ROLES.SYSTEM,
    OPENAI_MESSAGE_ROLES.USER,
    OPENAI_MESSAGE_ROLES.ASSISTANT,
    OPENAI_MESSAGE_ROLES.DEVELOPER,
  ]),
  content: OpenAIMessageContentSchema,
  name: z.string().optional(),
});

export type OpenAIMessageParamBase = z.infer<typeof OpenAIMessageParamBaseSchema>;

export const OpenAIAssistantMessageParamSchema = z.object({
  role: z.literal(OPENAI_MESSAGE_ROLES.ASSISTANT),
  content: OpenAIMessageContentSchema.optional(),
  tool_calls: z.array(OpenAIToolCallSchema).optional(),
});

export type OpenAIAssistantMessageParam = z.infer<typeof OpenAIAssistantMessageParamSchema>;

export const OpenAIToolMessageParamSchema = z.object({
  role: z.literal(OPENAI_TOOL_ROLE),
  content: z.union([z.string(), z.array(OpenAIContentPartSchema)]),
  tool_call_id: z.string(),
});

export type OpenAIToolMessageParam = z.infer<typeof OpenAIToolMessageParamSchema>;

export const OpenAIMessageParamSchema = z.union([
  OpenAIMessageParamBaseSchema,
  OpenAIAssistantMessageParamSchema,
  OpenAIToolMessageParamSchema,
]);

export type OpenAIMessageParam = z.infer<typeof OpenAIMessageParamSchema>;

export const OpenAIToolFunctionSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  parameters: z.record(z.unknown()),
});

export type OpenAIToolFunction = z.infer<typeof OpenAIToolFunctionSchema>;

export const OpenAIToolSchema = z.object({
  type: z.literal(OPENAI_TOOL_TYPES.FUNCTION),
  function: OpenAIToolFunctionSchema,
});

export type OpenAITool = z.infer<typeof OpenAIToolSchema>;

export const OpenAIToolChoiceAutoSchema = z.literal(OPENAI_TOOL_CHOICE_TYPES.AUTO);

export const OpenAIToolChoiceNoneSchema = z.literal(OPENAI_TOOL_CHOICE_TYPES.NONE);

export const OpenAIToolChoiceRequiredSchema = z.literal(OPENAI_TOOL_CHOICE_TYPES.REQUIRED);

export const OpenAIToolChoiceFunctionSchema = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string(),
  }),
});

export const OpenAIToolChoiceSchema = z.union([
  OpenAIToolChoiceAutoSchema,
  OpenAIToolChoiceNoneSchema,
  OpenAIToolChoiceRequiredSchema,
  OpenAIToolChoiceFunctionSchema,
]);

export type OpenAIToolChoice = z.infer<typeof OpenAIToolChoiceSchema>;

export const OpenAIStreamOptionsSchema = z.object({
  include_usage: z.boolean(),
});

export type OpenAIStreamOptions = z.infer<typeof OpenAIStreamOptionsSchema>;

export const OpenAIMetadataSchema = z.record(z.unknown());

export type OpenAIMetadata = z.infer<typeof OpenAIMetadataSchema>;

export const OpenAIChatCompletionRequestSchema = z.object({
  model: z.string(),
  messages: z.array(OpenAIMessageParamSchema).min(1),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  n: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  max_tokens: z.number().int().positive().optional(),
  max_completion_tokens: z.number().int().positive().optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  logit_bias: z.record(z.number()).optional(),
  user: z.string().optional(),
  tools: z.array(OpenAIToolSchema).optional(),
  tool_choice: OpenAIToolChoiceSchema.optional(),
  stream_options: OpenAIStreamOptionsSchema.optional(),
  metadata: OpenAIMetadataSchema.optional(),
});

export type OpenAIChatCompletionRequest = z.infer<typeof OpenAIChatCompletionRequestSchema>;

export const OpenAIUsageSchema = z.object({
  prompt_tokens: z.number().int().nonnegative(),
  completion_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
  prompt_tokens_details: z
    .object({
      cached_tokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
  completion_tokens_details: z
    .object({
      reasoning_tokens: z.number().int().nonnegative().optional(),
    })
    .optional(),
});

export type OpenAIUsage = z.infer<typeof OpenAIUsageSchema>;

export const OpenAIFunctionCallDeltaSchema = z.object({
  name: z.string().optional(),
  arguments: z.string().optional(),
});

export type OpenAIFunctionCallDelta = z.infer<typeof OpenAIFunctionCallDeltaSchema>;

export const OpenAIToolCallDeltaSchema = z.object({
  id: z.string().optional(),
  type: z.literal(OPENAI_TOOL_TYPES.FUNCTION).optional(),
  function: OpenAIFunctionCallDeltaSchema.optional(),
});

export type OpenAIToolCallDelta = z.infer<typeof OpenAIToolCallDeltaSchema>;

export const OpenAIChoiceDeltaSchema = z.object({
  role: z.literal(OPENAI_MESSAGE_ROLES.ASSISTANT).optional(),
  content: z.string().optional(),
  tool_calls: z.array(OpenAIToolCallDeltaSchema).optional(),
  refusal: z.string().optional(),
});

export type OpenAIChoiceDelta = z.infer<typeof OpenAIChoiceDeltaSchema>;

export const OpenAIChoiceSchema = z.object({
  index: z.number().int().nonnegative(),
  delta: OpenAIChoiceDeltaSchema.optional(),
  message: z
    .object({
      role: z.literal(OPENAI_MESSAGE_ROLES.ASSISTANT),
      content: z.string().optional(),
      tool_calls: z.array(OpenAIToolCallSchema).optional(),
    })
    .optional(),
  finish_reason: z
    .enum([
      OPENAI_FINISH_REASONS.STOP,
      OPENAI_FINISH_REASONS.LENGTH,
      OPENAI_FINISH_REASONS.CONTENT_FILTER,
      OPENAI_FINISH_REASONS.TOOL_CALLS,
    ])
    .nullable()
    .optional(),
});

export type OpenAIChoice = z.infer<typeof OpenAIChoiceSchema>;

export const OpenAIChatCompletionChunkSchema = z.object({
  id: z.string(),
  object: z.literal('chat.completion.chunk'),
  created: z.number().int(),
  model: z.string(),
  choices: z.array(OpenAIChoiceSchema),
  usage: OpenAIUsageSchema.optional(),
});

export type OpenAIChatCompletionChunk = z.infer<typeof OpenAIChatCompletionChunkSchema>;

export const OpenAIChatCompletionResponseSchema = z.object({
  id: z.string(),
  object: z.literal('chat.completion'),
  created: z.number().int(),
  model: z.string(),
  choices: z.array(OpenAIChoiceSchema),
  usage: OpenAIUsageSchema,
});

export type OpenAIChatCompletionResponse = z.infer<typeof OpenAIChatCompletionResponseSchema>;

export const OpenAIErrorResponseSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string(),
    param: z.string().nullable().optional(),
    code: z.string().nullable().optional(),
  }),
});

export type OpenAIErrorResponse = z.infer<typeof OpenAIErrorResponseSchema>;

export const OPENAI_CHAT_COMPLETION_OBJECT = 'chat.completion' as const;
export const OPENAI_CHAT_COMPLETION_CHUNK_OBJECT = 'chat.completion.chunk' as const;

export const OpenAIEmbeddingRequestSchema = z.object({
  model: z.string(),
  input: z.union([z.string(), z.array(z.string())]),
  dimensions: z.number().int().positive().optional(),
  encoding_format: z.enum(['float', 'base64']).optional(),
  user: z.string().optional(),
});

export type OpenAIEmbeddingRequest = z.infer<typeof OpenAIEmbeddingRequestSchema>;

export const OpenAIEmbeddingObjectSchema = z.object({
  object: z.literal('embedding'),
  embedding: z.array(z.number()),
  index: z.number().int().nonnegative(),
});

export type OpenAIEmbeddingObject = z.infer<typeof OpenAIEmbeddingObjectSchema>;

export const OpenAIEmbeddingResponseSchema = z.object({
  object: z.literal('list'),
  data: z.array(OpenAIEmbeddingObjectSchema),
  model: z.string(),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative(),
    total_tokens: z.number().int().nonnegative(),
  }),
});

export type OpenAIEmbeddingResponse = z.infer<typeof OpenAIEmbeddingResponseSchema>;
