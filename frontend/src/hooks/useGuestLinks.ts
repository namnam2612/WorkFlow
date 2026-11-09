import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { GuestLink } from '../types/api';

export function useGuestLinks(projectId: number, enabled: boolean) {
  return useQuery({ queryKey: ['guest-links', projectId], queryFn: () => api.get<GuestLink[]>(`/projects/${projectId}/guest-links`), enabled });
}

export function useCreateGuestLink(projectId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; expiresInDays?: number }) => api.post<GuestLink & { token: string }>(`/projects/${projectId}/guest-links`, input),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['guest-links'] }),
  });
}

export function useRevokeGuestLink() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: (id: number) => api.delete<GuestLink>(`/guest-links/${id}`), onSettled: () => queryClient.invalidateQueries({ queryKey: ['guest-links'] }) });
}
