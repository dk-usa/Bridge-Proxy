import { z } from 'zod';

export const CANONICAL_MESSAGE_ROLES = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
  TOOL: 'tool',
} as const;

export type CanonicalMessageRole =
  (typeof CANONICAL_MESSAGE_ROLES)[keyof typeof CANONICAL_MESSAGE_ROLES];

export const CANONICAL_CONTENT_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  TOOL_CALL: 'tool_call',
  TOOL_RESULT: 'tool_result',
} as const;

export type CanonicalContentType =
  (typeof CANONICAL_CONTENT_TYPES)[keyof typeof CANONICAL_CONTENT_TYPES];

export const CANONICAL_STOP_REASONS = {
  END_TURN: 'end_turn',
  MAX_TOKENS: 'max_tokens',
  STOP_SEQUENCE: 'stop_sequence',
  TOOL_CALL: 'tool_call',
  CONTENT_FILTER: 'content_filter',
} as const;

export type CanonicalStopReason =
  (typeof CANONICAL_STOP_REASONS)[keyof typeof CANONICAL_STOP_REASONS];

export const CanonicalTextContentSchema = z.object({
  type: z.literal(CANONICAL_CONTENT_TYPES.TEXT),
  text: z.string(),
});

export type CanonicalTextContent = z.infer<typeof CanonicalTextContentSchema>;

export const CanonicalImageContentSchema = z.object({
  type: z.literal(CANONICAL_CONTENT_TYPES.IMAGE),
  url: z.string(),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  isBase64: z.boolean(),
});

export type CanonicalImageContent = z.infer<typeof CanonicalImageContentSchema>;

export const CanonicalToolCallArgumentSchema = z.record(z.unknown());

export type CanonicalToolCallArgument = z.infer<typeof CanonicalToolCallArgumentSchema>;

export const CanonicalToolCallSchema = z.object({
  id: z.string(),
  name: z.string(),
  arguments: CanonicalToolCallArgumentSchema,
});

export type CanonicalToolCall = z.infer<typeof CanonicalToolCallSchema>;

export const CanonicalToolResultContentSchema = z.object({
  type: z.literal(CANONICAL_CONTENT_TYPES.TOOL_RESULT),
  tool_call_id: z.string(),
  content: z.string(),
  is_error: z.boolean().optional(),
});

export type CanonicalToolResultContent = z.infer<typeof CanonicalToolResultContentSchema>;

export const CanonicalContentSchema = z.union([
  CanonicalTextContentSchema,
  CanonicalImageContentSchema,
  CanonicalToolCallSchema,
  CanonicalToolResultContentSchema,
]);

export type CanonicalContent = z.infer<typeof CanonicalContentSchema>;

export const CanonicalMessageSchema = z.object({
  role: z.enum([
    CANONICAL_MESSAGE_ROLES.USER,
    CANONICAL_MESSAGE_ROLES.ASSISTANT,
    CANONICAL_MESSAGE_ROLES.SYSTEM,
    CANONICAL_MESSAGE_ROLES.TOOL,
  ]),
  content: z.array(CanonicalContentSchema),
  name: z.string().optional(),
  tool_call_id: z.string().optional(),
});

export type CanonicalMessage = z.infer<typeof CanonicalMessageSchema>;

export const CanonicalToolsSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  parameters: z.record(z.unknown()),
});

export type CanonicalTools = z.infer<typeof CanonicalToolsSchema>;

export const CanonicalToolChoiceSchema = z.union([
  z.literal('auto'),
  z.literal('required'),
  z.object({
    type: z.literal('tool'),
    name: z.string(),
  }),
]);

export type CanonicalToolChoice = z.infer<typeof CanonicalToolChoiceSchema>;

export const CanonicalUsageSchema = z.object({
  input_tokens: z.number().int().nonnegative(),
  output_tokens: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
  cached_tokens: z.number().int().nonnegative().optional(),
  reasoning_tokens: z.number().int().nonnegative().optional(),
});

export type CanonicalUsage = z.infer<typeof CanonicalUsageSchema>;

export const CanonicalRequestSchema = z.object({
  model: z.string(),
  messages: z.array(CanonicalMessageSchema).min(1),
  system: z.string().optional(),
  max_tokens: z.number().int().positive().min(1),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  stop_sequences: z.array(z.string()).optional(),
  tools: z.array(CanonicalToolsSchema).optional(),
  tool_choice: CanonicalToolChoiceSchema.optional(),
  stream: z.boolean().optional(),
  stream_options: z
    .object({
      include_usage: z.boolean(),
    })
    .optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CanonicalRequest = z.infer<typeof CanonicalRequestSchema>;

export const CanonicalResponseSchema = z.object({
  id: z.string(),
  model: z.string(),
  content: z.array(CanonicalContentSchema),
  stop_reason: z
    .enum([
      CANONICAL_STOP_REASONS.END_TURN,
      CANONICAL_STOP_REASONS.MAX_TOKENS,
      CANONICAL_STOP_REASONS.STOP_SEQUENCE,
      CANONICAL_STOP_REASONS.TOOL_CALL,
      CANONICAL_STOP_REASONS.CONTENT_FILTER,
    ])
    .optional(),
  usage: CanonicalUsageSchema,
});

export type CanonicalResponse = z.infer<typeof CanonicalResponseSchema>;

export const CanonicalErrorSchema = z.object({
  type: z.enum([
    'invalid_request_error',
    'authentication_error',
    'permission_error',
    'not_found_error',
    'rate_limit_error',
    'overloaded_error',
    'internal_error',
  ]),
  message: z.string(),
  status_code: z.number().int(),
  param: z.string().optional(),
  code: z.string().optional(),
});

export type CanonicalError = z.infer<typeof CanonicalErrorSchema>;

export const CanonicalStreamEventTypes = {
  MESSAGE_START: 'message_start',
  CONTENT_BLOCK_START: 'content_block_start',
  CONTENT_BLOCK_DELTA: 'content_block_delta',
  CONTENT_BLOCK_STOP: 'content_block_stop',
  MESSAGE_DELTA: 'message_delta',
  MESSAGE_STOP: 'message_stop',
  ERROR: 'error',
} as const;

export type CanonicalStreamEventType =
  (typeof CanonicalStreamEventTypes)[keyof typeof CanonicalStreamEventTypes];

export const CanonicalStreamEventTypesSchema = z.enum([
  CanonicalStreamEventTypes.MESSAGE_START,
  CanonicalStreamEventTypes.CONTENT_BLOCK_START,
  CanonicalStreamEventTypes.CONTENT_BLOCK_DELTA,
  CanonicalStreamEventTypes.CONTENT_BLOCK_STOP,
  CanonicalStreamEventTypes.MESSAGE_DELTA,
  CanonicalStreamEventTypes.MESSAGE_STOP,
  CanonicalStreamEventTypes.ERROR,
]);

export const CanonicalStreamEventSchema = z.object({
  type: CanonicalStreamEventTypesSchema,
  index: z.number().int().nonnegative().optional(),
  content: z.unknown().optional(),
  error: CanonicalErrorSchema.optional(),
});

export type CanonicalStreamEvent = z.infer<typeof CanonicalStreamEventSchema>;
