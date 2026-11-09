import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { DashboardData } from '../types/api';

export function useDashboard(params: { projectId?: number; mine?: boolean }) {
  return useQuery({
    queryKey: ['dashboard', params],
    queryFn: () => api.get<DashboardData>('/dashboard', params),
  });
}
