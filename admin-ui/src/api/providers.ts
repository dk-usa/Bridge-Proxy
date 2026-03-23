import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { apiClient } from './client';

export interface HealthStatus {
  status: string;
  timestamp: string;
  stats: {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    avgLatencyMs: number;
  };
  config: {
    adminTokenSet: boolean;
    providers: Array<{
      id: string;
      type: string;
      baseUrl: string;
      enabled: boolean;
    }>;
    modelMappingsCount: number;
  };
}

export interface ProviderHealth {
  id: string;
  type: string;
  baseUrl: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs: number | null;
  lastCheck: string | null;
  successCount: number;
  errorCount: number;
  totalCount: number;
}

export interface Provider {
  id: string;
  type: 'openai-compatible' | 'anthropic-compatible';
  apiKey?: string;
  baseUrl: string;
  models: string[];
  timeoutMs: number;
  enabled: boolean;
  priority: number;
  status: string;
  latencyMs: number | null;
  lastCheck: string | null;
  successCount: number;
  errorCount: number;
  totalCount: number;
}

export interface ModelMapping {
  anthropicModel: string;
  providerId: string;
  providerModel: string;
  providerType?: string;
  providerBaseUrl?: string;
}

export function useHealth() {
  return useQuery<HealthStatus>({
    queryKey: ['health'],
    queryFn: () => apiClient.get('/health').then((res) => res.data),
    refetchInterval: 10000,
  });
}

export function useProviderHealth() {
  return useQuery<{ providers: ProviderHealth[] }>({
    queryKey: ['providerHealth'],
    queryFn: () => apiClient.get('/health/providers').then((res) => res.data),
    refetchInterval: 10000,
  });
}

export function useProviders() {
  return useQuery<{ providers: Provider[] }>({
    queryKey: ['providers'],
    queryFn: () => apiClient.get('/providers').then((res) => res.data),
  });
}

export function useAddProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (provider: Omit<Provider, 'status' | 'latencyMs' | 'lastCheck' | 'successCount' | 'errorCount' | 'totalCount'>) => 
      apiClient.post('/providers', provider),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      queryClient.invalidateQueries({ queryKey: ['providerHealth'] });
    },
  });
}

export function useUpdateProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Provider> }) =>
      apiClient.put(`/providers/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      queryClient.invalidateQueries({ queryKey: ['providerHealth'] });
    },
  });
}

export function useDeleteProvider() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/providers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['providers'] });
      queryClient.invalidateQueries({ queryKey: ['providerHealth'] });
    },
  });
}

export function useTestProvider() {
  return useMutation({
    mutationFn: async (id: string) => {
      try {
        const response = await apiClient.post(`/providers/${id}/test`);
        return response.data;
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.data) {
          return error.response.data;
        }
        throw error;
      }
    },
  });
}

export function useModelMappings() {
  return useQuery<{ mappings: ModelMapping[] }>({
    queryKey: ['modelMappings'],
    queryFn: () => apiClient.get('/models').then((res) => res.data),
  });
}

export function useUpdateModelMappings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mappings: ModelMapping[]) => apiClient.put('/models', mappings),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modelMappings'] });
    },
  });
}

export function useAddModelMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ anthropicModel, providerId, providerModel }: { anthropicModel: string; providerId: string; providerModel: string }) =>
      apiClient.post('/models', { anthropicModel, providerId, providerModel }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modelMappings'] });
    },
  });
}

export function useDeleteModelMapping() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (anthropicModel: string) => apiClient.delete(`/models/${anthropicModel}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['modelMappings'] });
    },
  });
}
