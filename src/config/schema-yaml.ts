/**
 * Zod schema for YAML configuration following LiteLLM format.
 * Supports model_list with model_name and litellm_params,
 * os.environ/VAR_NAME substitution for API keys, and router settings.
 *
 * @see RESEARCH.md §Code Examples for schema structure
 */
import { z } from 'zod';

/**
 * LiteLLM provider parameters for a model deployment.
 * The 'model' field uses format: "provider/model-name" (e.g., "openai/gpt-4o")
 */
export const LitellmParamsSchema = z.object({
  model: z.string(),
  // Allow null from YAML and transform to empty string (missing env vars)
  api_key: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? ''),
  api_base: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? undefined),
  api_version: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? undefined),
  organization: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? undefined),
  rpm: z.number().optional(), // Requests per minute limit
  tpm: z.number().optional(), // Tokens per minute limit
  timeout: z.number().optional(),
  max_retries: z.number().optional(),
});

/**
 * A single model deployment entry in the model_list.
 * model_name is the user-facing alias, litellm_params contains provider details.
 */
export const ModelListItemSchema = z.object({
  model_name: z.string(), // User-facing alias
  litellm_params: LitellmParamsSchema,
});

/**
 * Routing strategy configuration for deployment selection.
 * Defaults follow LiteLLM conventions (per RESEARCH.md).
 */
export const RouterSettingsSchema = z.object({
  routing_strategy: z
    .enum([
      'simple-shuffle', // Weighted random (default)
      'least-busy', // Fewest in-flight requests
      'latency-based-routing', // Lowest recent latency
      'cost-based-routing', // Lowest cost per token
      'failover', // Priority-based failover
    ])
    .default('simple-shuffle'),
  num_retries: z.number().default(2),
  timeout: z.number().default(30),
  allowed_fails: z.number().default(3), // Triggers cooldown
  cooldown_time: z.number().default(30), // Seconds
});

/**
 * General settings for the gateway.
 * master_key is required for admin authentication.
 */
export const GeneralSettingsSchema = z.object({
  // Allow null from YAML and transform to empty string (missing env vars)
  master_key: z
    .string()
    .nullable()
    .transform((v) => v ?? ''),
  database_url: z
    .string()
    .nullable()
    .optional()
    .transform((v) => v ?? undefined),
});

/**
 * Complete YAML configuration schema.
 * Validates the structure of config.yaml for the universal bridge proxy.
 */
export const YamlConfigSchema = z.object({
  model_list: z.array(ModelListItemSchema),
  general_settings: GeneralSettingsSchema,
  router_settings: RouterSettingsSchema.optional(),
});

// Type exports for typed config objects
export type LitellmParams = z.infer<typeof LitellmParamsSchema>;
export type ModelListItem = z.infer<typeof ModelListItemSchema>;
export type RouterSettings = z.infer<typeof RouterSettingsSchema>;
export type GeneralSettings = z.infer<typeof GeneralSettingsSchema>;
export type YamlConfig = z.infer<typeof YamlConfigSchema>;
