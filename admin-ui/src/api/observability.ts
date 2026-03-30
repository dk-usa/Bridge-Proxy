import { useQuery } from '@tanstack/react-query';
import { apiClient } from './client';

export interface CostByKey {
  keyId: string;
  keyName: string;
  totalCost: number;
  requestCount: number;
}

export interface CostByModel {
  model: string;
  totalCost: number;
  requestCount: number;
}

export interface FallbackFrequency {
  from: string;
  to: string;
  count: number;
}

export interface LatencyBucket {
  bucket: string;
  count: number;
}

export interface LatencyStats {
  providerId: string;
  model: string;
  p50: number;
  p95: number;
  p99: number;
  histogram: LatencyBucket[];
}

export interface ObservabilitySummary {
  totalCost: number;
  totalRequests: number;
  avgLatency: number;
  topModels: { model: string; cost: number }[];
  fallbackRate: number;
  totalFallbacks: number;
}

export function useCostsByKey(startDate?: string, endDate?: string) {
  return useQuery<{ costs: CostByKey[] }>({
    queryKey: ['costsByKey', startDate, endDate],
    queryFn: () =>
      apiClient
        .get('/observability/costs/by-key', { params: { startDate, endDate } })
        .then((res) => res.data),
  });
}

export function useCostsByModel(startDate?: string, endDate?: string) {
  return useQuery<{ costs: CostByModel[] }>({
    queryKey: ['costsByModel', startDate, endDate],
    queryFn: () =>
      apiClient
        .get('/observability/costs/by-model', { params: { startDate, endDate } })
        .then((res) => res.data),
  });
}

export function useFallbackFrequency() {
  return useQuery<{ fallbacks: FallbackFrequency[] }>({
    queryKey: ['fallbackFrequency'],
    queryFn: () => apiClient.get('/observability/fallbacks').then((res) => res.data),
  });
}

export function useLatencyStats(providerId: string, model: string) {
  return useQuery<LatencyStats>({
    queryKey: ['latencyStats', providerId, model],
    queryFn: () =>
      apiClient
        .get(
          `/observability/latency/${encodeURIComponent(providerId)}/${encodeURIComponent(model)}`
        )
        .then((res) => res.data),
    enabled: !!providerId && !!model,
  });
}

export function useObservabilitySummary() {
  return useQuery<ObservabilitySummary>({
    queryKey: ['observabilitySummary'],
    queryFn: () => apiClient.get('/observability/summary').then((res) => res.data),
  });
}
