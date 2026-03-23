import { apiClient } from './client';

export interface Team {
  id: string;
  organizationId?: string;
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

export interface CreateTeamRequest {
  name: string;
  organizationId?: string;
  description?: string;
  budget?: number;
  budgetResetAt?: string;
  metadata?: Record<string, unknown>;
}

export const useTeams = () => {
  const fetchTeams = async (organizationId?: string): Promise<{ teams: Team[] }> => {
    const params = organizationId ? { organizationId } : {};
    const response = await apiClient.get('/admin/teams', { params });
    return response.data;
  };

  const fetchTeam = async (id: string): Promise<{ team: Team }> => {
    const response = await apiClient.get(`/admin/teams/${id}`);
    return response.data;
  };

  const createTeam = async (data: CreateTeamRequest): Promise<{ team: Team }> => {
    const response = await apiClient.post('/admin/teams', data);
    return response.data;
  };

  const updateTeam = async (
    id: string,
    data: Partial<CreateTeamRequest>
  ): Promise<{ team: Team }> => {
    const response = await apiClient.put(`/admin/teams/${id}`, data);
    return response.data;
  };

  const deleteTeam = async (id: string): Promise<void> => {
    await apiClient.delete(`/admin/teams/${id}`);
  };

  const getTeamStats = async (id: string) => {
    const response = await apiClient.get(`/admin/teams/${id}/stats`);
    return response.data;
  };

  return {
    fetchTeams,
    fetchTeam,
    createTeam,
    updateTeam,
    deleteTeam,
    getTeamStats,
  };
};
