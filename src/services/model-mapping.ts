import { z } from 'zod';

export const ModelMappingSchema = z.object({
  anthropicModel: z.string(),
  providerId: z.string(),
  providerModel: z.string(),
});

export type ModelMapping = z.infer<typeof ModelMappingSchema>;

class ModelMappingService {
  private mappings: Map<string, ModelMapping> = new Map();

  constructor() {
    this.initializeDefaults();
  }

  private initializeDefaults(): void {
    const defaultMappings: ModelMapping[] = [
      {
        anthropicModel: 'claude-3-5-sonnet-20240620',
        providerId: 'primary',
        providerModel: process.env.PRIMARY_MODEL || 'llama-3.1-70b-versatile',
      },
      {
        anthropicModel: 'claude-3-opus-20240229',
        providerId: 'primary',
        providerModel: process.env.PRIMARY_MODEL || 'llama-3.1-70b-versatile',
      },
      {
        anthropicModel: 'claude-3-haiku-20240307',
        providerId: 'primary',
        providerModel: process.env.PRIMARY_MODEL || 'llama-3.1-8b-versatile',
      },
      {
        anthropicModel: 'claude-sonnet-4-20250514',
        providerId: 'primary',
        providerModel: process.env.PRIMARY_MODEL || 'llama-3.3-70b-versatile',
      },
      {
        anthropicModel: 'claude-sonnet-4-6-20250514',
        providerId: 'primary',
        providerModel: process.env.PRIMARY_MODEL || 'llama-3.3-70b-versatile',
      },
      {
        anthropicModel: 'claude-3-5-sonnet',
        providerId: 'primary',
        providerModel: process.env.PRIMARY_MODEL || 'llama-3.1-70b-versatile',
      },
      {
        anthropicModel: 'claude-3-opus',
        providerId: 'primary',
        providerModel: process.env.PRIMARY_MODEL || 'llama-3.1-70b-versatile',
      },
      {
        anthropicModel: 'claude-3-haiku',
        providerId: 'primary',
        providerModel: process.env.PRIMARY_MODEL || 'llama-3.1-8b-versatile',
      },
      {
        anthropicModel: 'claude-sonnet-4',
        providerId: 'primary',
        providerModel: process.env.PRIMARY_MODEL || 'llama-3.3-70b-versatile',
      },
      {
        anthropicModel: 'claude-sonnet-4-6',
        providerId: 'primary',
        providerModel: process.env.PRIMARY_MODEL || 'llama-3.1-70b-versatile',
      },
      {
        anthropicModel: 'claude-opus-4-6',
        providerId: 'primary',
        providerModel: process.env.PRIMARY_MODEL || 'llama-3.1-70b-versatile',
      },
      {
        anthropicModel: 'nim',
        providerId: 'nim',
        providerModel: process.env.PRIMARY_MODEL || 'meta/llama-3.1-70b-instruct',
      },
    ];

    for (const mapping of defaultMappings) {
      this.mappings.set(mapping.anthropicModel, mapping);
    }
  }

  getAll(): ModelMapping[] {
    return Array.from(this.mappings.values());
  }

  getByAnthropicModel(anthropicModel: string): ModelMapping | undefined {
    return this.mappings.get(anthropicModel);
  }

  getByProviderId(providerId: string): ModelMapping[] {
    return this.getAll().filter((m) => m.providerId === providerId);
  }

  add(mapping: ModelMapping): ModelMapping {
    this.mappings.set(mapping.anthropicModel, mapping);
    return mapping;
  }

  update(anthropicModel: string, updates: Partial<ModelMapping>): ModelMapping | undefined {
    const existing = this.mappings.get(anthropicModel);
    if (!existing) return undefined;

    const updated = { ...existing, ...updates };
    this.mappings.set(anthropicModel, updated);
    return updated;
  }

  delete(anthropicModel: string): boolean {
    return this.mappings.delete(anthropicModel);
  }

  setMappings(mappings: ModelMapping[]): void {
    this.mappings.clear();
    for (const mapping of mappings) {
      this.mappings.set(mapping.anthropicModel, mapping);
    }
  }

  resolveModel(anthropicModel: string): { providerId: string; providerModel: string } | undefined {
    const mapping = this.mappings.get(anthropicModel);
    if (mapping) {
      return {
        providerId: mapping.providerId,
        providerModel: mapping.providerModel,
      };
    }

    for (const [key, value] of this.mappings.entries()) {
      if (
        anthropicModel.startsWith(key) ||
        key.startsWith(anthropicModel.split('-').slice(0, 3).join('-'))
      ) {
        return {
          providerId: value.providerId,
          providerModel: value.providerModel,
        };
      }
    }

    return undefined;
  }

  getMappedModels(): string[] {
    return Array.from(this.mappings.keys());
  }

  getProviderModels(providerId: string): string[] {
    return this.getByProviderId(providerId).map((m) => m.providerModel);
  }
}

export const modelMappingService = new ModelMappingService();
