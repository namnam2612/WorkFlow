import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Paginated, Role, User, UserProfile, UserStats } from '../types/api';

export type UserWithStats = User & { stats: UserStats };

export interface UserListParams {
  search?: string;
  role?: Role;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export function useUsers(params: UserListParams = {}, enabled = true) {
  return useQuery({
    queryKey: ['users', params],
    queryFn: () => api.get<Paginated<UserWithStats>>('/users', { pageSize: 100, ...params }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useUser(id: number | undefined) {
  return useQuery({
    queryKey: ['user', id],
    queryFn: () => api.get<UserProfile>(`/users/${id}`),
    enabled: id !== undefined && !Number.isNaN(id),
  });
}

export interface CreateUserInput {
  name: string;
  email: string;
  password: string;
  role: Role;
}

export interface UpdateUserInput {
  name?: string;
  avatarUrl?: string | null;
  role?: Role;
  isActive?: boolean;
  password?: string;
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateUserInput) => api.post<User>('/users', input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useUpdateUser(id: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateUserInput) => api.patch<User>(`/users/${id}`, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      await queryClient.invalidateQueries({ queryKey: ['user', id] });
    },
  });
}
