import { apiClient } from './client';

export interface Organization {
  id: string;
  name: string;
  description?: string;
  budget?: number;
  budgetResetAt?: string;
  spend: number;
  requestCount: number;
  enabled: boolean;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface CreateOrgRequest {
  name: string;
  description?: string;
  budget?: number;
  budgetResetAt?: string;
  metadata?: Record<string, unknown>;
}

export const useOrganizations = () => {
  const fetchOrganizations = async (): Promise<{ organizations: Organization[] }> => {
    const response = await apiClient.get('/admin/orgs');
    return response.data;
  };

  const fetchOrganization = async (id: string): Promise<{ organization: Organization }> => {
    const response = await apiClient.get(`/admin/orgs/${id}`);
    return response.data;
  };

  const createOrganization = async (
    data: CreateOrgRequest
  ): Promise<{ organization: Organization }> => {
    const response = await apiClient.post('/admin/orgs', data);
    return response.data;
  };

  const updateOrganization = async (
    id: string,
    data: Partial<CreateOrgRequest>
  ): Promise<{ organization: Organization }> => {
    const response = await apiClient.put(`/admin/orgs/${id}`, data);
    return response.data;
  };

  const deleteOrganization = async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/orgs/${id}`);
  };

  const getOrgStats = async (id: string) => {
    const response = await apiClient.get(`/admin/orgs/${id}/stats`);
    return response.data;
  };

  return {
    fetchOrganizations,
    fetchOrganization,
    createOrganization,
    updateOrganization,
    deleteOrganization,
    getOrgStats,
  };
};
