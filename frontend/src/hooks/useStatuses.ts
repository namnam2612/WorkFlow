import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ProjectStatus, StatusCategory, StatusScope } from '../types/api';

export const statusesKey = (projectId: number) => ['statuses', projectId] as const;

/** Mọi trạng thái của dự án (cả hai bộ: công việc và Bug), đã xếp theo thứ tự */
export function useProjectStatuses(projectId: number | undefined) {
  return useQuery({
    queryKey: statusesKey(projectId ?? 0),
    queryFn: () => api.get<ProjectStatus[]>(`/projects/${projectId}/statuses`),
    enabled: projectId !== undefined && !Number.isNaN(projectId),
    staleTime: 60_000,
  });
}

export const statusesOf = (all: ProjectStatus[] | undefined, scope: StatusScope): ProjectStatus[] => (all ?? []).filter((s) => s.scope === scope);

export interface StatusInput {
  scope: StatusScope;
  name: string;
  color: string;
  category: StatusCategory;
}

/** Sau khi sửa trạng thái, task/bảng/dashboard đều có thể đổi theo */
function useStatusMutation<V>(projectId: number, fn: (variables: V) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: async () => {
      await Promise.all(['statuses', 'tasks', 'board', 'task', 'dashboard', 'projects', 'project', 'files'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
    },
    meta: { projectId },
  });
}

export const useCreateStatus = (projectId: number) => useStatusMutation(projectId, (input: StatusInput) => api.post<ProjectStatus>(`/projects/${projectId}/statuses`, input));

export const useUpdateStatus = (projectId: number) =>
  useStatusMutation(projectId, ({ id, ...input }: { id: number } & Partial<Pick<StatusInput, 'name' | 'color' | 'category'>>) => api.patch<ProjectStatus>(`/projects/${projectId}/statuses/${id}`, input));

export const useDeleteStatus = (projectId: number) =>
  useStatusMutation(projectId, ({ id, moveTo }: { id: number; moveTo?: number }) => api.delete(`/projects/${projectId}/statuses/${id}${moveTo ? `?moveTo=${moveTo}` : ''}`));

export const useReorderStatuses = (projectId: number) =>
  useStatusMutation(projectId, (input: { scope: StatusScope; ids: number[] }) => api.put<ProjectStatus[]>(`/projects/${projectId}/statuses/order`, input));
