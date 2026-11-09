import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Specialty, Team, TeamDetail } from '../types/api';

export function useTeams(enabled = true) {
  return useQuery({ queryKey: ['teams'], queryFn: () => api.get<Team[]>('/teams'), enabled });
}

export function useTeam(id: number) {
  return useQuery({ queryKey: ['team', id], queryFn: () => api.get<TeamDetail>(`/teams/${id}`), enabled: !Number.isNaN(id) });
}

function useTeamMutation<V, R = unknown>(fn: (variables: V) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: async () => {
      await Promise.all(['teams', 'team', 'projects', 'project', 'leaves', 'capacity'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
    },
  });
}

export const useCreateTeam = () => useTeamMutation((input: { name: string; description?: string | null; leaderId?: number }) => api.post<Team>('/teams', input));
export const useUpdateTeam = (id: number) => useTeamMutation((input: { name?: string; description?: string | null; leaderId?: number }) => api.patch<Team>(`/teams/${id}`, input));
export const useDeleteTeam = () => useTeamMutation((id: number) => api.delete(`/teams/${id}`));
export const useAddTeamMember = (id: number) => useTeamMutation((input: { userId: number; specialty?: Specialty }) => api.post<TeamDetail>(`/teams/${id}/members`, input));
export const useUpdateTeamMember = (id: number) => useTeamMutation(({ userId, specialty }: { userId: number; specialty: Specialty }) => api.patch<TeamDetail>(`/teams/${id}/members/${userId}`, { specialty }));
export const useRemoveTeamMember = (id: number) => useTeamMutation((userId: number) => api.delete<TeamDetail>(`/teams/${id}/members/${userId}`));
