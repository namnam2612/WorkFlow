import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { AutomationAction, AutomationConditions, AutomationRule, AutomationTrigger } from '../types/api';

export function useAutomations(projectId: number) {
  return useQuery({ queryKey: ['automations', projectId], queryFn: () => api.get<AutomationRule[]>(`/projects/${projectId}/automations`), enabled: !Number.isNaN(projectId) });
}

function useAutomationMutation<V>(fn: (variables: V) => Promise<unknown>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSettled: () => queryClient.invalidateQueries({ queryKey: ['automations'] }) });
}

export interface AutomationInput {
  name: string;
  trigger: AutomationTrigger;
  conditions: AutomationConditions;
  actions: AutomationAction[];
  enabled?: boolean;
}

export const useCreateAutomation = (projectId: number) => useAutomationMutation((input: AutomationInput) => api.post<AutomationRule>(`/projects/${projectId}/automations`, input));
export const useUpdateAutomation = () => useAutomationMutation(({ id, ...input }: { id: number } & Partial<AutomationInput>) => api.patch<AutomationRule>(`/automations/${id}`, input));
export const useDeleteAutomation = () => useAutomationMutation((id: number) => api.delete(`/automations/${id}`));
