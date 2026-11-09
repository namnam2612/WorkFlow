import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { WorkLog } from '../types/api';

export function useWorklogs(taskId: number) {
  return useQuery({ queryKey: ['worklogs', taskId], queryFn: () => api.get<{ items: WorkLog[]; totalMinutes: number }>(`/tasks/${taskId}/worklogs`), enabled: !Number.isNaN(taskId) });
}

/** Ghi/xóa thời gian đổi giờ thực tế của task, lịch sử, báo cáo chấm công */
function useWorklogMutation<V>(taskId: number, fn: (variables: V) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: async () => {
      await Promise.all([['worklogs'], ['task', taskId], ['activity', taskId], ['tasks'], ['timesheet']].map((queryKey) => queryClient.invalidateQueries({ queryKey })));
    },
  });
}

export const useAddWorklog = (taskId: number) => useWorklogMutation(taskId, (input: { minutes: number; workedOn?: string; note?: string | null }) => api.post<WorkLog>(`/tasks/${taskId}/worklogs`, input));
export const useDeleteWorklog = (taskId: number) => useWorklogMutation(taskId, (id: number) => api.delete(`/worklogs/${id}`));
