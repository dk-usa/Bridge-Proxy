import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export interface RequestLog {
  id: string;
  timestamp: string;
  method: string;
  url: string;
  statusCode: number;
  model?: string;
  provider?: string;
  latencyMs: number;
  status: 'success' | 'error';
  anthropicRequest?: unknown;
  normalizedRequest?: unknown;
  openaiRequest?: unknown;
  providerResponse?: unknown;
  anthropicResponse?: unknown;
  error?: string;
}

export interface LogsResponse {
  logs: RequestLog[];
  total: number;
}

export interface Trace {
  request_id: string;
  timestamp: string;
  method: string;
  url: string;
  status: string;
  latency_ms: number;
  provider?: string;
  model?: string;
  steps: Array<{
    name: string;
    data: unknown;
  }>;
  error?: string;
}

export interface LogsParams {
  limit?: number;
  offset?: number;
  status?: 'success' | 'error';
  provider?: string;
  model?: string;
  search?: string;
}

export function useRequestLogs(params?: LogsParams) {
  return useQuery<LogsResponse>({
    queryKey: ['logs', params],
    queryFn: () => apiClient.get('/logs', { params }).then((res) => res.data),
    refetchInterval: 5000,
  });
}

export function useLogDetail(id: string) {
  return useQuery<{ log: RequestLog }>({
    queryKey: ['log', id],
    queryFn: () => apiClient.get(`/logs/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

export function useTrace(id: string) {
  return useQuery<{ trace: Trace }>({
    queryKey: ['trace', id],
    queryFn: () => apiClient.get(`/traces/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

export function useClearLogs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiClient.delete('/logs'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
  });
}

export function useLogStream(enabled: boolean = false) {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setLogs([]);
      return;
    }

    const eventSource = new EventSource(`${apiClient.defaults.baseURL}/admin/stream/logs`);

    eventSource.onopen = () => {
      setConnected(true);
      setError(null);
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.logs && Array.isArray(data.logs)) {
          setLogs((prev) => {
            const newLogs = [...data.logs, ...prev].slice(0, 100);
            return newLogs;
          });
        }
      } catch (e) {
        console.error('Failed to parse log event:', e);
      }
    };

    eventSource.onerror = () => {
      setConnected(false);
      setError('Connection lost. Reconnecting...');
      eventSource.close();
      setTimeout(() => {
        if (enabled) {
          setError('Reconnecting...');
        }
      }, 3000);
    };

    return () => {
      eventSource.close();
      setConnected(false);
    };
  }, [enabled]);

  return { logs, connected, error };
}
