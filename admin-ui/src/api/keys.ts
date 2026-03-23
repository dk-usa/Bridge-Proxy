import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export interface ApiKey {
  id: string;
  key: string;
  name: string;
  description?: string;
  teamId?: string;
  providerId?: string;
  modelRestrictions?: string[];
  budget: number | null;
  budgetResetAt?: string;
  spend: number;
  requestCount: number;
  rateLimit?: number;
  enabled: boolean;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface Team {
  id: string;
  name: string;
  description?: string;
  budget: number | null;
  spend: number;
  requestCount: number;
  members?: string[];
  createdAt: string;
}

export interface KeyStats {
  totalKeys: number;
  totalTeams: number;
  totalSpend: number;
  totalRequests: number;
}

export function useApiKeys(teamId?: string) {
  return useQuery<{ keys: ApiKey[] }>({
    queryKey: ['apiKeys', teamId],
    queryFn: () => apiClient.get('/keys').then((res) => res.data),
  });
}

export function useApiKey(id: string) {
  return useQuery<{ key: ApiKey }>({
    queryKey: ['apiKey', id],
    queryFn: () => apiClient.get(`/keys/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name: string;
      description?: string;
      teamId?: string;
      providerId?: string;
      modelRestrictions?: string[];
      budget?: number | null;
      rateLimit?: number;
      expiresInDays?: number | null;
    }) => apiClient.post('/keys', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      queryClient.invalidateQueries({ queryKey: ['keyStats'] });
    },
  });
}

export function useUpdateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ApiKey> }) =>
      apiClient.put(`/keys/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      queryClient.invalidateQueries({ queryKey: ['keyStats'] });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      queryClient.invalidateQueries({ queryKey: ['keyStats'] });
    },
  });
}

export function useRotateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/keys/${id}/rotate`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
    },
  });
}

export function useResetKeySpend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/keys/${id}/reset-spend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      queryClient.invalidateQueries({ queryKey: ['keyStats'] });
    },
  });
}

export function useTeams() {
  return useQuery<{ teams: Team[] }>({
    queryKey: ['teams'],
    queryFn: () => apiClient.get('/teams').then((res) => res.data),
  });
}

export function useTeam(id: string) {
  return useQuery<{ team: Team }>({
    queryKey: ['team', id],
    queryFn: () => apiClient.get(`/teams/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; description?: string; budget?: number | null }) =>
      apiClient.post('/teams', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['keyStats'] });
    },
  });
}

export function useUpdateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Team> }) =>
      apiClient.put(`/teams/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['keyStats'] });
    },
  });
}

export function useDeleteTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/teams/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['keyStats'] });
    },
  });
}

export function useResetTeamSpend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/teams/${id}/reset-spend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      queryClient.invalidateQueries({ queryKey: ['apiKeys'] });
      queryClient.invalidateQueries({ queryKey: ['keyStats'] });
    },
  });
}

export function useKeyStats() {
  return useQuery<{ stats: KeyStats }>({
    queryKey: ['keyStats'],
    queryFn: () => apiClient.get('/keys/stats').then((res) => res.data),
  });
}
