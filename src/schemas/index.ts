export * from './anthropic.js';
export * from './openai.js';
export * from './canonical.js';

import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

export const ErrorResponseSchema = z.object({
  type: z.string(),
  error: z.object({
    type: z.string(),
    message: z.string(),
    param: z.string().optional(),
    code: z.string().optional(),
  }),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

export function toJsonSchema<T extends z.ZodType>(
  schema: T,
  options?: { target?: 'openApi3' | 'jsonSchema2019-09' | 'jsonSchema7' }
): ReturnType<typeof zodToJsonSchema> {
  return zodToJsonSchema(schema, options ?? 'jsonSchema7');
}
