import { z } from 'zod';

export const ANTHROPIC_CONTENT_BLOCK_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  TOOL_USE: 'tool_use',
  TOOL_RESULT: 'tool_result',
} as const;

export type AnthropicContentBlockType =
  (typeof ANTHROPIC_CONTENT_BLOCK_TYPES)[keyof typeof ANTHROPIC_CONTENT_BLOCK_TYPES];

export const ANTHROPIC_IMAGE_MEDIA_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
] as const;

export type AnthropicImageMediaType = (typeof ANTHROPIC_IMAGE_MEDIA_TYPES)[number];

export const ANTHROPIC_IMAGE_SOURCE_TYPES = {
  BASE64: 'base64',
  URL: 'url',
} as const;

export type AnthropicImageSourceType =
  (typeof ANTHROPIC_IMAGE_SOURCE_TYPES)[keyof typeof ANTHROPIC_IMAGE_SOURCE_TYPES];

export const ANTHROPIC_MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
} as const;

export type AnthropicMessageRole =
  (typeof ANTHROPIC_MESSAGE_ROLES)[keyof typeof ANTHROPIC_MESSAGE_ROLES];

export const ANTHROPIC_STOP_REASONS = {
  END_TURN: 'end_turn',
  MAX_TOKENS: 'max_tokens',
  STOP_SEQUENCE: 'stop_sequence',
  TOOL_USE: 'tool_use',
  PAUSE_TURN: 'pause_turn',
} as const;

export type AnthropicStopReason =
  (typeof ANTHROPIC_STOP_REASONS)[keyof typeof ANTHROPIC_STOP_REASONS];

export const ANTHROPIC_TOOL_CHOICE_TYPES = {
  AUTO: 'auto',
  ANY: 'any',
  TOOL: 'tool',
} as const;

export type AnthropicToolChoiceType =
  (typeof ANTHROPIC_TOOL_CHOICE_TYPES)[keyof typeof ANTHROPIC_TOOL_CHOICE_TYPES];

export const ANTHROPIC_CACHE_CONTROL_TTL = {
  FIVE_MINUTES: '5m',
  ONE_HOUR: '1h',
} as const;

export type AnthropicCacheControlTTL =
  (typeof ANTHROPIC_CACHE_CONTROL_TTL)[keyof typeof ANTHROPIC_CACHE_CONTROL_TTL];

export const ANTHROPIC_ERROR_TYPES = {
  INVALID_REQUEST: 'invalid_request_error',
  AUTHENTICATION: 'authentication_error',
  PERMISSION: 'permission_error',
  NOT_FOUND: 'not_found_error',
  RATE_LIMIT: 'rate_limit_error',
  OVERLOADED: 'overloaded_error',
  INTERNAL: 'internal_error',
} as const;

export type AnthropicErrorType = (typeof ANTHROPIC_ERROR_TYPES)[keyof typeof ANTHROPIC_ERROR_TYPES];

export const AnthropicImageSourceBase64Schema = z.object({
  type: z.literal(ANTHROPIC_IMAGE_SOURCE_TYPES.BASE64),
  media_type: z.enum(ANTHROPIC_IMAGE_MEDIA_TYPES),
  data: z.string(),
});

export type AnthropicImageSourceBase64 = z.infer<typeof AnthropicImageSourceBase64Schema>;

export const AnthropicImageSourceUrlSchema = z.object({
  type: z.literal(ANTHROPIC_IMAGE_SOURCE_TYPES.URL),
  url: z.string().url(),
  media_type: z.enum(ANTHROPIC_IMAGE_MEDIA_TYPES).optional(),
});

export type AnthropicImageSourceUrl = z.infer<typeof AnthropicImageSourceUrlSchema>;

export const AnthropicImageSourceSchema = z.union([
  AnthropicImageSourceBase64Schema,
  AnthropicImageSourceUrlSchema,
]);

export type AnthropicImageSource = z.infer<typeof AnthropicImageSourceSchema>;

export const AnthropicCacheControlSchema = z.object({
  type: z.literal('ephemeral'),
  ttl: z
    .enum([ANTHROPIC_CACHE_CONTROL_TTL.FIVE_MINUTES, ANTHROPIC_CACHE_CONTROL_TTL.ONE_HOUR])
    .optional(),
});

export type AnthropicCacheControl = z.infer<typeof AnthropicCacheControlSchema>;

export const AnthropicTextBlockSchema = z.object({
  type: z.literal(ANTHROPIC_CONTENT_BLOCK_TYPES.TEXT),
  text: z.string(),
  citations: z.unknown().optional(),
});

export type AnthropicTextBlock = z.infer<typeof AnthropicTextBlockSchema>;

export const AnthropicImageBlockSchema = z.object({
  type: z.literal(ANTHROPIC_CONTENT_BLOCK_TYPES.IMAGE),
  source: AnthropicImageSourceSchema,
});

export type AnthropicImageBlock = z.infer<typeof AnthropicImageBlockSchema>;

export const AnthropicToolUseBlockSchema = z.object({
  type: z.literal(ANTHROPIC_CONTENT_BLOCK_TYPES.TOOL_USE),
  id: z.string(),
  name: z.string(),
  input: z.record(z.unknown()),
});

export type AnthropicToolUseBlock = z.infer<typeof AnthropicToolUseBlockSchema>;

export const AnthropicToolResultBlockSchema = z.object({
  type: z.literal(ANTHROPIC_CONTENT_BLOCK_TYPES.TOOL_RESULT),
  tool_use_id: z.string(),
  content: z.union([z.string(), z.array(z.unknown())]),
  is_error: z.boolean().optional(),
});

export type AnthropicToolResultBlock = z.infer<typeof AnthropicToolResultBlockSchema>;

export const AnthropicContentBlockSchema = z.union([
  AnthropicTextBlockSchema,
  AnthropicImageBlockSchema,
  AnthropicToolUseBlockSchema,
  AnthropicToolResultBlockSchema,
]);

export type AnthropicContentBlock = z.infer<typeof AnthropicContentBlockSchema>;

export const AnthropicContentBlockParamSchema = z.union([
  z.string(),
  AnthropicTextBlockSchema,
  AnthropicImageBlockSchema,
  AnthropicToolUseBlockSchema,
  AnthropicToolResultBlockSchema,
]);

export type AnthropicContentBlockParam = z.infer<typeof AnthropicContentBlockParamSchema>;

export const AnthropicSystemTextBlockSchema = z.object({
  type: z.literal(ANTHROPIC_CONTENT_BLOCK_TYPES.TEXT),
  text: z.string(),
  cache_control: AnthropicCacheControlSchema.optional(),
});

export type AnthropicSystemTextBlock = z.infer<typeof AnthropicSystemTextBlockSchema>;

export const AnthropicSystemPromptSchema = z.union([
  z.string(),
  z.array(AnthropicSystemTextBlockSchema),
]);

export type AnthropicSystemPrompt = z.infer<typeof AnthropicSystemPromptSchema>;

export const AnthropicMessageParamSchema = z.object({
  role: z.enum([ANTHROPIC_MESSAGE_ROLES.USER, ANTHROPIC_MESSAGE_ROLES.ASSISTANT]),
  content: z.any(),
});

export type AnthropicMessageParam = z.infer<typeof AnthropicMessageParamSchema>;

export const AnthropicToolInputSchemaSchema = z.record(z.unknown());

export type AnthropicToolInputSchema = z.infer<typeof AnthropicToolInputSchemaSchema>;

export const AnthropicToolSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  input_schema: AnthropicToolInputSchemaSchema,
});

export type AnthropicTool = z.infer<typeof AnthropicToolSchema>;

export const AnthropicToolChoiceAutoSchema = z.object({
  type: z.literal(ANTHROPIC_TOOL_CHOICE_TYPES.AUTO),
});

export const AnthropicToolChoiceAnySchema = z.object({
  type: z.literal(ANTHROPIC_TOOL_CHOICE_TYPES.ANY),
});

export const AnthropicToolChoiceToolSchema = z.object({
  type: z.literal(ANTHROPIC_TOOL_CHOICE_TYPES.TOOL),
  name: z.string(),
});

export const AnthropicToolChoiceSchema = z.union([
  AnthropicToolChoiceAutoSchema,
  AnthropicToolChoiceAnySchema,
  AnthropicToolChoiceToolSchema,
]);

export type AnthropicToolChoice = z.infer<typeof AnthropicToolChoiceSchema>;

export const AnthropicStreamOptionsSchema = z.object({
  include_usage: z.boolean(),
});

export type AnthropicStreamOptions = z.infer<typeof AnthropicStreamOptionsSchema>;

export const AnthropicMetadataSchema = z.record(z.unknown());

export type AnthropicMetadata = z.infer<typeof AnthropicMetadataSchema>;

export const AnthropicMessageRequestSchema = z.object({
  model: z.string(),
  messages: z.array(AnthropicMessageParamSchema).min(1),
  system: AnthropicSystemPromptSchema.optional(),
  max_tokens: z.number().int().positive().min(1),
  metadata: AnthropicMetadataSchema.optional(),
  stop_sequences: z.array(z.string()).optional(),
  temperature: z.number().min(0).max(1).optional(),
  top_p: z.number().min(0).max(1).optional(),
  top_k: z.number().int().positive().optional(),
  tools: z.array(AnthropicToolSchema).optional(),
  tool_choice: AnthropicToolChoiceSchema.optional(),
  stream: z.boolean().optional(),
  stream_options: AnthropicStreamOptionsSchema.optional(),
});

export type AnthropicMessageRequest = z.infer<typeof AnthropicMessageRequestSchema>;

export const AnthropicUsageSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  cache_creation_input_tokens: z.number().int().nonnegative().optional(),
  cache_read_input_tokens: z.number().int().nonnegative().optional(),
});

export type AnthropicUsage = z.infer<typeof AnthropicUsageSchema>;

export const AnthropicMessageResponseSchema = z.object({
  id: z.string(),
  type: z.literal('message'),
  role: z.literal('assistant'),
  content: z.array(AnthropicContentBlockSchema),
  model: z.string(),
  stop_reason: z
    .enum([
      ANTHROPIC_STOP_REASONS.END_TURN,
      ANTHROPIC_STOP_REASONS.MAX_TOKENS,
      ANTHROPIC_STOP_REASONS.STOP_SEQUENCE,
      ANTHROPIC_STOP_REASONS.TOOL_USE,
      ANTHROPIC_STOP_REASONS.PAUSE_TURN,
    ])
    .optional(),
  stop_sequence: z.string().optional(),
  usage: AnthropicUsageSchema,
});

export type AnthropicMessageResponse = z.infer<typeof AnthropicMessageResponseSchema>;

export const AnthropicErrorResponseSchema = z.object({
  type: z.literal('error'),
  error: z.object({
    type: z.string(),
    message: z.string(),
    param: z.string().optional(),
  }),
});

export type AnthropicErrorResponse = z.infer<typeof AnthropicErrorResponseSchema>;

export const ANTHROPIC_STREAM_EVENT_TYPES = {
  MESSAGE_START: 'message_start',
  CONTENT_BLOCK_START: 'content_block_start',
  CONTENT_BLOCK_DELTA: 'content_block_delta',
  CONTENT_BLOCK_STOP: 'content_block_stop',
  MESSAGE_DELTA: 'message_delta',
  MESSAGE_STOP: 'message_stop',
  ERROR: 'error',
} as const;

export type AnthropicStreamEventType =
  (typeof ANTHROPIC_STREAM_EVENT_TYPES)[keyof typeof ANTHROPIC_STREAM_EVENT_TYPES];

export const AnthropicStreamMessageStartSchema = z.object({
  type: z.literal(ANTHROPIC_STREAM_EVENT_TYPES.MESSAGE_START),
  message: AnthropicMessageResponseSchema.omit({
    content: true,
    stop_reason: true,
    stop_sequence: true,
  }),
});

export const AnthropicStreamContentBlockStartSchema = z.object({
  type: z.literal(ANTHROPIC_STREAM_EVENT_TYPES.CONTENT_BLOCK_START),
  index: z.number().int().nonnegative(),
  content_block: z.object({ type: z.string() }),
});

export const AnthropicStreamContentBlockDeltaTextSchema = z.object({
  type: z.literal('text_delta'),
  text: z.string(),
});

export const AnthropicStreamContentBlockDeltaToolUseSchema = z.object({
  type: z.literal('input_json_delta'),
  partial_json: z.string(),
});

export const AnthropicStreamContentBlockDeltaSchema = z.object({
  type: z.literal(ANTHROPIC_STREAM_EVENT_TYPES.CONTENT_BLOCK_DELTA),
  index: z.number().int().nonnegative(),
  delta: z.union([
    AnthropicStreamContentBlockDeltaTextSchema,
    AnthropicStreamContentBlockDeltaToolUseSchema,
  ]),
});

export const AnthropicStreamContentBlockStopSchema = z.object({
  type: z.literal(ANTHROPIC_STREAM_EVENT_TYPES.CONTENT_BLOCK_STOP),
  index: z.number().int().nonnegative(),
});

export const AnthropicStreamMessageDeltaSchema = z.object({
  type: z.literal(ANTHROPIC_STREAM_EVENT_TYPES.MESSAGE_DELTA),
  delta: z.object({
    stop_reason: z.string().optional(),
    usage: z.object({ output_tokens: z.number().int().nonnegative() }).optional(),
  }),
  usage: z.object({ output_tokens: z.number().int().nonnegative() }).optional(),
});

export const AnthropicStreamMessageStopSchema = z.object({
  type: z.literal(ANTHROPIC_STREAM_EVENT_TYPES.MESSAGE_STOP),
});

export const AnthropicStreamEventSchema = z.union([
  AnthropicStreamMessageStartSchema,
  AnthropicStreamContentBlockStartSchema,
  AnthropicStreamContentBlockDeltaSchema,
  AnthropicStreamContentBlockStopSchema,
  AnthropicStreamMessageDeltaSchema,
  AnthropicStreamMessageStopSchema,
]);

export type AnthropicStreamEvent = z.infer<typeof AnthropicStreamEventSchema>;
