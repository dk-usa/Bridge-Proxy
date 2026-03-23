import { apiClient } from './client';

export interface User {
  id: string;
  organizationId?: string;
  teamId?: string;
  name: string;
  email: string;
  budget?: number;
  budgetResetAt?: string;
  spend: number;
  requestCount: number;
  enabled: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreateUserRequest {
  name: string;
  email: string;
  organizationId?: string;
  teamId?: string;
  budget?: number;
  budgetResetAt?: string;
  metadata?: Record<string, unknown>;
}

export const useUsers = () => {
  const fetchUsers = async (params?: {
    organizationId?: string;
    teamId?: string;
  }): Promise<{ users: User[] }> => {
    const response = await apiClient.get('/admin/users', { params });
    return response.data;
  };

  const fetchUser = async (id: string): Promise<{ user: User }> => {
    const response = await apiClient.get(`/admin/users/${id}`);
    return response.data;
  };

  const createUser = async (data: CreateUserRequest): Promise<{ user: User }> => {
    const response = await apiClient.post('/admin/users', data);
    return response.data;
  };

  const updateUser = async (
    id: string,
    data: Partial<CreateUserRequest>
  ): Promise<{ user: User }> => {
    const response = await apiClient.put(`/admin/users/${id}`, data);
    return response.data;
  };

  const deleteUser = async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/users/${id}`);
  };

  return {
    fetchUsers,
    fetchUser,
    createUser,
    updateUser,
    deleteUser,
  };
};
