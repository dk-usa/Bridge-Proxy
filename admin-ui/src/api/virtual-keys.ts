import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from './client';

export interface VirtualKey {
  id: string;
  key: string;
  name: string;
  description?: string;
  teamId?: string;
  orgId?: string;
  models?: string[];
  maxBudget?: number;
  budgetDuration?: string;
  spend: number;
  rpmLimit?: number;
  tpmLimit?: number;
  enabled: boolean;
  createdAt: string;
  expiresAt?: string;
  rotationEnabled: boolean;
  rotationIntervalDays?: number;
  lastRotatedAt?: string;
  rotatedFrom?: string;
  rotatedTo?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateVirtualKeyInput {
  name: string;
  description?: string;
  teamId?: string;
  orgId?: string;
  models?: string[];
  maxBudget?: number;
  budgetDuration?: '30d' | '1m';
  rpmLimit?: number;
  tpmLimit?: number;
  expiresInDays?: number;
  rotationEnabled?: boolean;
  rotationIntervalDays?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateVirtualKeyInput {
  name?: string;
  description?: string;
  teamId?: string;
  orgId?: string;
  models?: string[];
  maxBudget?: number;
  budgetDuration?: '30d' | '1m';
  rpmLimit?: number;
  tpmLimit?: number;
  enabled?: boolean;
  expiresAt?: string;
  rotationEnabled?: boolean;
  rotationIntervalDays?: number;
  metadata?: Record<string, unknown>;
}

export function useVirtualKeys(teamId?: string) {
  return useQuery<{ keys: VirtualKey[] }>({
    queryKey: ['virtualKeys', teamId],
    queryFn: () => apiClient.get('/virtual-keys', { params: { teamId } }).then((res) => res.data),
  });
}

export function useVirtualKey(id: string) {
  return useQuery<{ key: VirtualKey }>({
    queryKey: ['virtualKey', id],
    queryFn: () => apiClient.get(`/virtual-keys/${id}`).then((res) => res.data),
    enabled: !!id,
  });
}

export function useCreateVirtualKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateVirtualKeyInput) =>
      apiClient.post('/virtual-keys', data).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtualKeys'] });
    },
  });
}

export function useUpdateVirtualKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateVirtualKeyInput }) =>
      apiClient.put(`/virtual-keys/${id}`, data).then((res) => res.data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['virtualKeys'] });
      queryClient.invalidateQueries({ queryKey: ['virtualKey', variables.id] });
    },
  });
}

export function useDeleteVirtualKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/virtual-keys/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtualKeys'] });
    },
  });
}

export function useRotateVirtualKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post(`/virtual-keys/${id}/rotate`).then((res) => res.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtualKeys'] });
    },
  });
}

export function useResetVirtualKeySpend() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.post(`/virtual-keys/${id}/reset-spend`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['virtualKeys'] });
    },
  });
}
