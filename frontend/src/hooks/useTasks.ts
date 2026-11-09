import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { BugSeverity, Environment, Paginated, Priority, Task, TaskDetail, TaskFilters, TaskType } from '../types/api';

export interface TaskInput {
  projectId?: number;
  parentId?: number | null;
  title?: string;
  description?: string | null;
  /** Thay TOÀN BỘ danh sách người được giao (người đã có giữ nguyên, người mới thêm được báo) */
  assigneeIds?: number[];
  type?: TaskType;
  statusId?: number;
  storyPoints?: number | null;
  startDate?: string | null;
  sprintId?: number | null;
  epicId?: number | null;
  severity?: BugSeverity | null;
  environment?: Environment | null;
  priority?: Priority;
  deadline?: string | null;
  estimatedHours?: number | null;
  actualHours?: number | null;
}

/** Làm mới mọi dữ liệu có thể bị ảnh hưởng bởi thay đổi task */
export async function invalidateTaskRelated(queryClient: QueryClient, taskId?: number): Promise<void> {
  const keys: unknown[][] = [['tasks'], ['my-work'], ['board'], ['dashboard'], ['projects'], ['project'], ['users'], ['user'], ['attachments'], ['files']];
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

export interface MyWork {
  /** 00:00 giờ Việt Nam của hôm nay (UTC) */
  date: string;
  overdue: Task[];
  dueToday: Task[];
  inProgress: Task[];
  upcoming: Task[];
  doneToday: number;
}

export function useMyWork() {
  return useQuery({ queryKey: ['my-work'], queryFn: () => api.get<MyWork>('/tasks/my-work') });
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

export function useBoard(projectId: number) {
  return useQuery({
    queryKey: boardKey(projectId),
    queryFn: () => api.get<Task[]>('/tasks/board', { projectId }),
    enabled: !Number.isNaN(projectId),
  });
}

export const boardKey = (projectId: number) => ['board', projectId] as const;

interface MoveVariables {
  id: number;
  statusId: number;
  position: number;
  /** Trạng thái bảng sau khi kéo thả, dùng để cập nhật cache ngay (optimistic) */
  optimistic: Task[];
}

/** Di chuyển task trên Kanban: cập nhật cache ngay, lỗi thì hoàn tác về trạng thái trước */
export function useMoveTask(projectId: number, onError?: (error: unknown) => void) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, statusId, position }: MoveVariables) => api.patch<TaskDetail>(`/tasks/${id}/move`, { statusId, position }),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: boardKey(projectId) });
      const previous = queryClient.getQueryData<Task[]>(boardKey(projectId));
      queryClient.setQueryData<Task[]>(boardKey(projectId), variables.optimistic);
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context?.previous) queryClient.setQueryData<Task[]>(boardKey(projectId), context.previous);
      onError?.(error);
    },
    onSettled: () => invalidateTaskRelated(queryClient),
  });
}
