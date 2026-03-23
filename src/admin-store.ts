import { z } from 'zod';
import { providerRegistry, modelMappingService, requestLogger } from './services/index.js';
import type { Provider, ProviderStatus, RequestLog, ModelMapping } from './services/index.js';

export type { Provider, ProviderStatus, RequestLog, ModelMapping };

export const ProviderHealthSchema = z.object({
  id: z.string(),
  type: z.enum(['openai-compatible', 'anthropic-compatible']),
  baseUrl: z.string(),
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  latencyMs: z.number().nullable(),
  lastCheck: z.string(),
  successCount: z.number(),
  errorCount: z.number(),
  totalCount: z.number(),
});

export type ProviderHealth = z.infer<typeof ProviderHealthSchema>;

export class AdminStore {
  initializeFromConfig(config: {
    primary?: { apiKey?: string; baseUrl?: string; model?: string; timeout?: number };
    fallback?: { apiKey?: string; baseUrl?: string; model?: string; timeout?: number };
  }): void {
    providerRegistry.setConfig(config);
  }

  addLog(log: RequestLog): void {
    requestLogger.addLog(log);

    if (log.provider) {
      if (log.status === 'success') {
        providerRegistry.recordSuccess(log.provider);
      } else {
        providerRegistry.recordError(log.provider);
      }
    }
  }

  getLogs(options?: Parameters<typeof requestLogger.getLogs>[0]): {
    logs: RequestLog[];
    total: number;
  } {
    return requestLogger.getLogs(options);
  }

  getLogById(id: string): RequestLog | undefined {
    return requestLogger.getLogById(id);
  }

  clearLogs(): void {
    requestLogger.clearLogs();
  }

  getStats(): ReturnType<typeof requestLogger.getStats> {
    return requestLogger.getStats();
  }

  getProviders(): Provider[] {
    return providerRegistry.getAll();
  }

  getProviderById(id: string): Provider | undefined {
    return providerRegistry.getById(id);
  }

  addProvider(provider: Provider): Provider {
    return providerRegistry.add(provider);
  }

  updateProvider(id: string, updates: Partial<Provider>): Provider | undefined {
    return providerRegistry.update(id, updates);
  }

  deleteProvider(id: string): boolean {
    return providerRegistry.delete(id);
  }

  getProviderHealth(): ProviderHealth[] {
    const providers = providerRegistry.getAll();
    const statusMap = new Map(providerRegistry.getAllStatus().map((s) => [s.id, s]));

    return providers.map((p) => {
      const status = statusMap.get(p.id);
      return {
        id: p.id,
        type: p.type,
        baseUrl: p.baseUrl,
        status: status?.status ?? 'unhealthy',
        latencyMs: status?.latencyMs ?? null,
        lastCheck: status?.lastCheck ?? '',
        successCount: status?.successCount ?? 0,
        errorCount: status?.errorCount ?? 0,
        totalCount: status?.totalCount ?? 0,
      };
    });
  }

  updateProviderHealth(id: string, health: Partial<ProviderStatus>): void {
    providerRegistry.updateStatus(id, health);
  }

  getModelMappings(): ModelMapping[] {
    return modelMappingService.getAll();
  }

  getModelMapping(anthropicModel: string): ModelMapping | undefined {
    return modelMappingService.getByAnthropicModel(anthropicModel);
  }

  addModelMapping(mapping: ModelMapping): ModelMapping {
    return modelMappingService.add(mapping);
  }

  updateModelMapping(
    anthropicModel: string,
    updates: Partial<ModelMapping>
  ): ModelMapping | undefined {
    return modelMappingService.update(anthropicModel, updates);
  }

  deleteModelMapping(anthropicModel: string): boolean {
    return modelMappingService.delete(anthropicModel);
  }

  setModelMappings(mappings: ModelMapping[]): void {
    modelMappingService.setMappings(mappings);
  }

  resolveModel(anthropicModel: string): { providerId: string; providerModel: string } | undefined {
    return modelMappingService.resolveModel(anthropicModel);
  }

  getEnabledProviders(): Provider[] {
    return providerRegistry.getEnabled();
  }
}

export const adminStore = new AdminStore();
