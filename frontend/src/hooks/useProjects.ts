import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ProjectDetail, ProjectSummary } from '../types/api';

export interface ProjectInput {
  name: string;
  description?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  /** undefined = giữ nguyên; null = gỡ; chuỗi = đặt mới */
  slackWebhookUrl?: string | null;
  memberIds?: number[];
}

export function useProjects(search?: string) {
  return useQuery({
    queryKey: ['projects', { search: search ?? '' }],
    queryFn: () => api.get<ProjectSummary[]>('/projects', { search }),
  });
}

export function useProject(id: number | undefined) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => api.get<ProjectDetail>(`/projects/${id}`),
    enabled: id !== undefined && !Number.isNaN(id),
  });
}

export function useSaveProject(id?: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectInput) =>
      id === undefined ? api.post<ProjectDetail>('/projects', input) : api.patch<ProjectDetail>(`/projects/${id}`, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      if (id !== undefined) await queryClient.invalidateQueries({ queryKey: ['project', id] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/projects/${id}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
  });
}

export function useProjectMembers(projectId: number) {
  const queryClient = useQueryClient();
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    await queryClient.invalidateQueries({ queryKey: ['projects'] });
    await queryClient.invalidateQueries({ queryKey: ['tasks'] });
    await queryClient.invalidateQueries({ queryKey: ['board'] });
  };
  const add = useMutation({
    mutationFn: (userId: number) => api.post<ProjectDetail>(`/projects/${projectId}/members`, { userId }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (userId: number) => api.delete<ProjectDetail>(`/projects/${projectId}/members/${userId}`),
    onSuccess: refresh,
  });
  return { add, remove };
}
