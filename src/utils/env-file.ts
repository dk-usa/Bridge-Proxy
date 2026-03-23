import { writeFileSync, existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

export interface ProviderEnvConfig {
  id: string;
  type: string;
  apiKey?: string;
  baseUrl: string;
  models: string[];
  timeoutMs: number;
  enabled: boolean;
  priority: number;
}

export function saveProvidersToEnv(providers: ProviderEnvConfig[]): void {
  const envPath = resolve(process.cwd(), '.env');
  const lines: string[] = [];

  const existingContent = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
  const existingLines = existingContent.split('\n').filter((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return true;
    const upperLine = trimmed.toUpperCase();
    return (
      !upperLine.includes('_TYPE=') &&
      !upperLine.includes('_API_KEY=') &&
      !upperLine.includes('_BASE_URL=') &&
      !upperLine.includes('_MODELS=') &&
      !upperLine.includes('_TIMEOUT_MS=') &&
      !upperLine.includes('_ENABLED=') &&
      !upperLine.includes('_PRIORITY=')
    );
  });

  for (const provider of providers) {
    if (provider.enabled) {
      const prefix = provider.id.toUpperCase().replace(/-/g, '_');
      lines.push(`# Provider: ${provider.id}`);
      lines.push(`${prefix}_TYPE=${provider.type}`);
      if (provider.apiKey) {
        lines.push(`${prefix}_API_KEY=${provider.apiKey}`);
      }
      lines.push(`${prefix}_BASE_URL=${provider.baseUrl}`);
      if (provider.models.length > 0) {
        lines.push(`${prefix}_MODELS=${provider.models.join(',')}`);
      }
      lines.push(`${prefix}_TIMEOUT_MS=${provider.timeoutMs}`);
      lines.push(`${prefix}_ENABLED=${provider.enabled}`);
      lines.push(`${prefix}_PRIORITY=${provider.priority}`);
      lines.push('');
    }
  }

  const newContent = existingLines.join('\n') + '\n' + lines.join('\n');
  writeFileSync(envPath, newContent.trim() + '\n');
}

export function loadProvidersFromEnv(): ProviderEnvConfig[] {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return [];

  const content = readFileSync(envPath, 'utf-8');
  const providers: ProviderEnvConfig[] = [];
  const lines = content.split('\n');

  let currentProvider: Partial<ProviderEnvConfig> | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      if (trimmed.startsWith('# Provider:')) {
        if (currentProvider?.id) {
          providers.push(currentProvider as ProviderEnvConfig);
        }
        const id = trimmed.replace('# Provider:', '').trim();
        currentProvider = {
          id,
          type: 'openai-compatible',
          models: [],
          timeoutMs: 60000,
          enabled: true,
          priority: 0,
        };
      }
      continue;
    }

    if (currentProvider) {
      const [key, value] = trimmed.split('=');
      if (!key || value === undefined) continue;

      const configKey = key.replace(/^[A-Z_]+_/, '');
      switch (configKey) {
        case 'TYPE':
          currentProvider.type = value;
          break;
        case 'API_KEY':
          currentProvider.apiKey = value;
          break;
        case 'BASE_URL':
          currentProvider.baseUrl = value;
          break;
        case 'MODELS':
          currentProvider.models = value.split(',').filter(Boolean);
          break;
        case 'TIMEOUT_MS':
          currentProvider.timeoutMs = parseInt(value, 10);
          break;
        case 'ENABLED':
          currentProvider.enabled = value === 'true';
          break;
        case 'PRIORITY':
          currentProvider.priority = parseInt(value, 10);
          break;
      }
    }
  }

  if (currentProvider?.id) {
    providers.push(currentProvider as ProviderEnvConfig);
  }

  return providers;
}

export function deleteProviderFromEnv(providerId: string): void {
  const envPath = resolve(process.cwd(), '.env');
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, 'utf-8');
  const lines = content.split('\n');
  const prefix = providerId.toUpperCase().replace(/-/g, '_');

  const filteredLines = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      if (trimmed.startsWith(`# Provider: ${providerId}`)) {
        return false;
      }
      return true;
    }
    const upperLine = trimmed.toUpperCase();
    return (
      !upperLine.includes(`${prefix}_TYPE=`) &&
      !upperLine.includes(`${prefix}_API_KEY=`) &&
      !upperLine.includes(`${prefix}_BASE_URL=`) &&
      !upperLine.includes(`${prefix}_MODELS=`) &&
      !upperLine.includes(`${prefix}_TIMEOUT_MS=`) &&
      !upperLine.includes(`${prefix}_ENABLED=`) &&
      !upperLine.includes(`${prefix}_PRIORITY=`)
    );
  });

  writeFileSync(envPath, filteredLines.join('\n').trim() + '\n');
}
