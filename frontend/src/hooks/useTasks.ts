import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Paginated, Priority, Task, TaskDetail, TaskFilters, TaskStatus } from '../types/api';

export interface TaskInput {
  projectId?: number;
  parentId?: number | null;
  title?: string;
  description?: string | null;
  assigneeId?: number | null;
  status?: TaskStatus;
  priority?: Priority;
  deadline?: string | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
}

export interface BoardFilters {
  assigneeId?: number;
  priority?: Priority;
}

/** Làm mới mọi dữ liệu có thể bị ảnh hưởng bởi thay đổi task */
export async function invalidateTaskRelated(queryClient: QueryClient, taskId?: number): Promise<void> {
  const keys: unknown[][] = [['tasks'], ['board'], ['dashboard'], ['projects'], ['project'], ['users'], ['user']];
  if (taskId !== undefined) keys.push(['task', taskId], ['activity', taskId]);
  await Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}

export function useTasks(filters: TaskFilters & { includeSubtasks?: boolean; overdue?: boolean }, enabled = true) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => api.get<Paginated<Task>>('/tasks', { ...filters }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useTask(id: number | undefined) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: () => api.get<TaskDetail>(`/tasks/${id}`),
    enabled: id !== undefined && !Number.isNaN(id),
  });
}

export function useCreateTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskInput) => api.post<TaskDetail>('/tasks', input),
    onSuccess: (task) => invalidateTaskRelated(queryClient, task.parentId ?? task.id),
  });
}

export function useUpdateTask(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskInput) => api.patch<TaskDetail>(`/tasks/${id}`, input),
    onSuccess: (task) => invalidateTaskRelated(queryClient, task.parentId ?? id).then(() => queryClient.invalidateQueries({ queryKey: ['task', id] })),
  });
}

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.delete(`/tasks/${id}`),
    onSuccess: () => invalidateTaskRelated(queryClient),
  });
}

export function useBoard(projectId: number, filters: BoardFilters) {
  return useQuery({
    queryKey: ['board', projectId, filters],
    queryFn: () => api.get<Task[]>('/tasks/board', { projectId, ...filters }),
    enabled: !Number.isNaN(projectId),
  });
}
