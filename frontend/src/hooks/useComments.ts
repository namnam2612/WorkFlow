import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { ActivityLogEntry, Comment } from '../types/api';

export function useComments(taskId: number) {
  return useQuery({ queryKey: ['comments', taskId], queryFn: () => api.get<Comment[]>(`/tasks/${taskId}/comments`) });
}

export function useActivity(taskId: number, enabled: boolean) {
  return useQuery({ queryKey: ['activity', taskId], queryFn: () => api.get<ActivityLogEntry[]>(`/tasks/${taskId}/activity`), enabled });
}

export function useCommentMutations(taskId: number) {
  const queryClient = useQueryClient();
  const refresh = async () => {
    await Promise.all(
      [['comments', taskId], ['activity', taskId], ['task', taskId], ['tasks'], ['board']].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
    );
  };
  const add = useMutation({ mutationFn: (content: string) => api.post<Comment>(`/tasks/${taskId}/comments`, { content }), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (commentId: number) => api.delete(`/comments/${commentId}`), onSuccess: refresh });
  return { add, remove };
}
