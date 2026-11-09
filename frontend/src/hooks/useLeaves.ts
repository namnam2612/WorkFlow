import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Capacity, Leave, LeaveType, SprintCapacity } from '../types/api';

export function useLeaves(params: { from?: string; to?: string; status?: string }) {
  return useQuery({ queryKey: ['leaves', params], queryFn: () => api.get<Leave[]>('/leaves', params) });
}

export function useSprintCapacity(sprintId: number | undefined) {
  return useQuery({ queryKey: ['capacity', 'sprint', sprintId], queryFn: () => api.get<SprintCapacity>(`/sprints/${sprintId}/capacity`), enabled: sprintId !== undefined });
}

export function useProjectCapacity(projectId: number, from: string, to: string) {
  return useQuery({ queryKey: ['capacity', 'project', projectId, from, to], queryFn: () => api.get<Capacity>(`/projects/${projectId}/capacity`, { from, to }), enabled: !Number.isNaN(projectId) });
}

function useLeaveMutation<V>(fn: (variables: V) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: async () => {
      await Promise.all(['leaves', 'capacity', 'calendar', 'notifications'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
    },
  });
}

export const useCreateLeave = () => useLeaveMutation((input: { startDate: string; endDate: string; type: LeaveType; reason?: string | null }) => api.post<Leave>('/leaves', input));
export const useCancelLeave = () => useLeaveMutation((id: number) => api.post<Leave>(`/leaves/${id}/cancel`));
export const useReviewLeave = () => useLeaveMutation(({ id, approve, note }: { id: number; approve: boolean; note?: string | null }) => api.post<Leave>(`/leaves/${id}/review`, { approve, note: note ?? null }));
