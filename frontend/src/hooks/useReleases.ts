import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Release, ReleaseDetail } from '../types/api';

export function useReleases(projectId: number | undefined) {
  return useQuery({ queryKey: ['releases', projectId], queryFn: () => api.get<Release[]>(`/projects/${projectId}/releases`), enabled: projectId !== undefined && !Number.isNaN(projectId) });
}

export function useRelease(id: number) {
  return useQuery({ queryKey: ['release', id], queryFn: () => api.get<ReleaseDetail>(`/releases/${id}`), enabled: !Number.isNaN(id) });
}

function useReleaseMutation<V>(fn: (variables: V) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: async () => {
      await Promise.all(['releases', 'release', 'tasks', 'task'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
    },
  });
}

export interface ReleaseInput {
  version: string;
  name?: string | null;
  description?: string | null;
}

export const useCreateRelease = (projectId: number) => useReleaseMutation((input: ReleaseInput) => api.post<Release>(`/projects/${projectId}/releases`, input));
export const useUpdateRelease = () => useReleaseMutation(({ id, ...input }: { id: number } & Partial<ReleaseInput>) => api.patch<Release>(`/releases/${id}`, input));
export const useDeleteRelease = () => useReleaseMutation((id: number) => api.delete(`/releases/${id}`));
export const usePublishRelease = () => useReleaseMutation(({ id, force }: { id: number; force?: boolean }) => api.post<Release>(`/releases/${id}/publish`, { force: force === true }));
