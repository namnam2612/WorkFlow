import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { io } from 'socket.io-client';
import { useToast } from '../components/ui/useToast';
import { api } from '../lib/api';
import { tokenStore } from '../lib/tokens';
import type { AppNotification } from '../types/api';
import { invalidateTaskRelated } from './useTasks';

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string | undefined) || undefined;

/** Kết nối Socket.IO khi đã đăng nhập: nhận thông báo mới và sự kiện thay đổi task theo thời gian thực */
export function useRealtime(userId: number | undefined): void {
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (userId === undefined) return;

    const socket = io(SOCKET_URL, {
      // Hàm: đọc token mới nhất mỗi lần (tái) kết nối
      auth: (callback) => callback({ token: tokenStore.getAccess() }),
    });

    socket.on('notification', (notification: AppNotification) => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      toast.show(notification.message, 'info');
    });

    socket.on('task:changed', (event: { projectId: number; taskId: number }) => {
      void invalidateTaskRelated(queryClient, event.taskId);
      void queryClient.invalidateQueries({ queryKey: ['comments', event.taskId] });
    });

    // Access token hết hạn: gọi một request thường để api client tự refresh, rồi kết nối lại
    socket.on('connect_error', (error) => {
      if (error.message !== 'unauthorized') return;
      void api
        .get('/auth/me')
        .then(() => {
          if (tokenStore.getAccess()) socket.connect();
        })
        .catch(() => undefined);
    });

    return () => {
      socket.close();
    };
  }, [userId, queryClient, toast]);
}
