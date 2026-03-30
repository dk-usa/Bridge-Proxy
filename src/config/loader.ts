/**
 * YAML config loader with environment variable substitution.
 * Follows LiteLLM pattern: os.environ/VAR_NAME → process.env[VAR_NAME]
 *
 * @see RESEARCH.md §Pattern 1 for env substitution approach
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parse } from 'yaml';
import { YamlConfigSchema, type YamlConfig } from './schema-yaml.js';

/**
 * Regex pattern to match os.environ/VAR_NAME syntax.
 * Matches: os.environ/ANY_VAR_NAME
 */
const ENV_VAR_PATTERN = /os\.environ\/(\w+)/g;

/**
 * Substitute environment variables in a string.
 * Replaces os.environ/VAR_NAME with process.env[VAR_NAME] or empty string if not set.
 *
 * @param content - String containing os.environ/VAR_NAME patterns
 * @returns String with env vars substituted
 */
export function substituteEnvVars(content: string): string {
  return content.replace(ENV_VAR_PATTERN, (_, varName: string) => {
    return process.env[varName] ?? '';
  });
}

/**
 * Load and parse a YAML config file with environment variable substitution.
 *
 * Process:
 * 1. Read file content
 * 2. Substitute os.environ/VAR_NAME with process.env values
 * 3. Parse substituted YAML
 * 4. Validate against YamlConfigSchema
 *
 * @param filePath - Path to YAML config file
 * @returns Validated YamlConfig object
 * @throws Error if file not found, YAML parse error, or validation failure
 */
export function loadYamlConfig(filePath: string): YamlConfig {
  // Read file content
  const absolutePath = resolve(filePath);
  const content = readFileSync(absolutePath, 'utf-8');

  // Substitute environment variables
  const substituted = substituteEnvVars(content);

  // Parse YAML
  const parsed = parse(substituted);

  // Validate against schema
  const result = YamlConfigSchema.safeParse(parsed);

  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Config validation failed: ${issues}`);
  }

  return result.data;
}
