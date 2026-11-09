import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { BacklogData, BurndownData, Sprint, SprintWithStats, Timesheet, VelocityData } from '../types/api';

export const backlogKey = (projectId: number) => ['backlog', projectId] as const;

export function useBacklog(projectId: number, includeDone: boolean) {
  return useQuery({
    queryKey: [...backlogKey(projectId), includeDone],
    queryFn: () => api.get<BacklogData>(`/projects/${projectId}/backlog`, { includeDone }),
    enabled: !Number.isNaN(projectId),
  });
}

/** Mọi sprint của dự án (kèm thống kê) — dùng cho ô chọn sprint trong form và trang báo cáo */
export function useSprints(projectId: number | undefined) {
  return useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => api.get<SprintWithStats[]>(`/projects/${projectId}/sprints`),
    enabled: projectId !== undefined && !Number.isNaN(projectId),
  });
}

export function useBurndown(sprintId: number | undefined) {
  return useQuery({ queryKey: ['burndown', sprintId], queryFn: () => api.get<BurndownData>(`/sprints/${sprintId}/burndown`), enabled: sprintId !== undefined });
}

export function useVelocity(projectId: number) {
  return useQuery({ queryKey: ['velocity', projectId], queryFn: () => api.get<VelocityData>(`/projects/${projectId}/velocity`, { limit: 8 }), enabled: !Number.isNaN(projectId) });
}

export function useTimesheet(projectId: number, from: string, to: string) {
  return useQuery({ queryKey: ['timesheet', projectId, from, to], queryFn: () => api.get<Timesheet>(`/projects/${projectId}/timesheet`, { from, to }), enabled: !Number.isNaN(projectId) });
}

/** Sprint đổi => backlog, danh sách sprint, task, báo cáo và dashboard đều có thể đổi */
function useSprintMutation<V, R = unknown>(fn: (variables: V) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: async () => {
      await Promise.all(['backlog', 'sprints', 'burndown', 'velocity', 'tasks', 'task', 'board', 'dashboard', 'my-work'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
    },
  });
}

export interface SprintInput {
  name: string;
  goal?: string | null;
  startDate?: string | null;
  endDate?: string | null;
}

export const useCreateSprint = (projectId: number) => useSprintMutation((input: SprintInput) => api.post<Sprint>(`/projects/${projectId}/sprints`, input));
export const useUpdateSprint = () => useSprintMutation(({ id, ...input }: { id: number } & Partial<SprintInput>) => api.patch<Sprint>(`/sprints/${id}`, input));
export const useDeleteSprint = () => useSprintMutation((id: number) => api.delete(`/sprints/${id}`));
export const useStartSprint = () => useSprintMutation((id: number) => api.post<Sprint>(`/sprints/${id}/start`));
export const useCompleteSprint = () => useSprintMutation(({ id, moveIncompleteTo }: { id: number; moveIncompleteTo?: number | null }) => api.post<Sprint>(`/sprints/${id}/complete`, { moveIncompleteTo: moveIncompleteTo ?? null }));

/** Đưa việc vào sprint (sprintId) hoặc về backlog (null) */
export const useMoveToSprint = (projectId: number) =>
  useSprintMutation(({ sprintId, taskIds }: { sprintId: number | null; taskIds: number[] }) =>
    sprintId === null ? api.post(`/projects/${projectId}/backlog/tasks`, { taskIds }) : api.post(`/sprints/${sprintId}/tasks`, { taskIds }),
  );
