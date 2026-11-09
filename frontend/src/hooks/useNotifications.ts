import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { AppNotification, Paginated } from '../types/api';

export function useUnreadCount() {
  return useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => api.get<{ count: number }>('/notifications/unread-count'),
    // Dự phòng nếu mất kết nối realtime
    refetchInterval: 60_000,
    select: (data) => data.count,
  });
}

export function useNotificationList(params: { page?: number; pageSize?: number; unread?: boolean }, enabled = true) {
  return useQuery({
    queryKey: ['notifications', 'list', params],
    queryFn: () => api.get<Paginated<AppNotification>>('/notifications', params),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useNotificationMutations() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['notifications'] });
  const markRead = useMutation({ mutationFn: (id: number) => api.patch<AppNotification>(`/notifications/${id}/read`, {}), onSuccess: refresh });
  const markAllRead = useMutation({ mutationFn: () => api.post<{ updated: number }>('/notifications/read-all'), onSuccess: refresh });
  return { markRead, markAllRead };
}
