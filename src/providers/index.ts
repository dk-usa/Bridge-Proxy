export * from './base.js';
export * from './errors.js';
export * from './openai-compatible.js';
export * from './anthropic.js';
export * from './azure.js';
export * from './google.js';
export * from './cohere.js';
export * from './mistral.js';

import type { Provider, ProviderConfig } from './base.js';
import { PROVIDER_TYPES } from './base.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';
import { AnthropicProvider } from './anthropic.js';
import { AzureProvider } from './azure.js';
import { GoogleProvider } from './google.js';
import { CohereProvider } from './cohere.js';
import { MistralProvider } from './mistral.js';

export function createProvider(type: string, config: ProviderConfig): Provider {
  switch (type) {
    case PROVIDER_TYPES.OPENAI_COMPATIBLE:
      return new OpenAICompatibleProvider(config);
    case PROVIDER_TYPES.ANTHROPIC:
      return new AnthropicProvider(config);
    case PROVIDER_TYPES.AZURE:
      return new AzureProvider(config);
    case PROVIDER_TYPES.GOOGLE:
      return new GoogleProvider(config);
    case PROVIDER_TYPES.COHERE:
      return new CohereProvider(config);
    case PROVIDER_TYPES.MISTRAL:
      return new MistralProvider(config);
    default:
      throw new Error(`Unknown provider type: ${type}`);
  }
}

export function isOpenAICompatibleProvider(
  provider: Provider
): provider is OpenAICompatibleProvider {
  return provider.type === PROVIDER_TYPES.OPENAI_COMPATIBLE;
}

export function isAnthropicProvider(provider: Provider): provider is AnthropicProvider {
  return provider.type === PROVIDER_TYPES.ANTHROPIC;
}
