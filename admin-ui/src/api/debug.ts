import { useMutation } from '@tanstack/react-query';
import { apiClient } from './client';

export function useDebugTranslate() {
  return useMutation({
    mutationFn: (request: unknown) =>
      apiClient.post('/debug/translate', { request }).then((res) => res.data),
  });
}

export function useReplayRequest() {
  return useMutation({
    mutationFn: ({ id, provider }: { id: string; provider?: 'primary' | 'fallback' }) =>
      apiClient.post(`/replay/${id}`, { provider }).then((res) => res.data),
  });
}
