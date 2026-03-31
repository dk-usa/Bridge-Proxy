/**
 * Dynamic provider registration from YAML config.
 * Registers providers from LiteLLM-format YAML config into ProviderRegistry.
 *
 * @see RESEARCH.md §Pattern 1 for YAML config structure
 */
import type { YamlConfig } from './schema-yaml.js';
import { providerRegistry, getProviderType, type Provider } from '../services/provider-registry.js';

/**
 * Register providers from a YAML config's model_list.
 * Creates or updates providers in the ProviderRegistry.
 *
 * Process:
 * 1. Iterate each model in model_list
 * 2. Extract model_name as provider ID
 * 3. Parse provider type from litellm_params.model
 * 4. Create Provider object with all config fields
 * 5. Add to registry (or update if exists)
 *
 * @param config - Validated YamlConfig object
 */
export function registerProvidersFromConfig(config: YamlConfig): void {
  if (!config.model_list || config.model_list.length === 0) {
    return;
  }

  for (const modelItem of config.model_list) {
    const { model_name, litellm_params } = modelItem;

    // Derive provider ID from model_name
    const providerId = model_name;

    // Get provider type from model string (e.g., "openai/gpt-4o" -> "openai-compatible")
    const providerType = getProviderType(litellm_params.model);

    // Create Provider object
    const provider: Provider = {
      id: providerId,
      type: providerType as Provider['type'],
      baseUrl: litellm_params.api_base ?? '',
      apiKey: litellm_params.api_key ?? '',
      models: [litellm_params.model],
      timeoutMs: litellm_params.timeout ?? 60000,
      enabled: true,
      priority: 0, // Can be extended later
    };

    // Check if provider exists and update, or add new
    const existing = providerRegistry.getById(providerId);
    if (existing) {
      providerRegistry.update(providerId, provider);
    } else {
      providerRegistry.add(provider);
    }
  }
}
