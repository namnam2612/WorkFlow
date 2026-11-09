import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { WikiNode, WikiPageDetail, WikiRevisionView } from '../types/api';

export function useWikiTree(projectId: number) {
  return useQuery({ queryKey: ['wiki-tree', projectId], queryFn: () => api.get<WikiNode[]>(`/projects/${projectId}/wiki`), enabled: !Number.isNaN(projectId) });
}

export function useWikiPage(id: number | undefined) {
  return useQuery({ queryKey: ['wiki-page', id], queryFn: () => api.get<WikiPageDetail>(`/wiki/${id}`), enabled: id !== undefined && !Number.isNaN(id) });
}

export function useWikiRevisions(id: number | undefined, enabled: boolean) {
  return useQuery({ queryKey: ['wiki-revisions', id], queryFn: () => api.get<WikiRevisionView[]>(`/wiki/${id}/revisions`), enabled: enabled && id !== undefined });
}

export function useApiSpecTemplate(enabled: boolean) {
  return useQuery({ queryKey: ['wiki-template'], queryFn: () => api.get<{ content: string }>('/wiki-templates/api-spec'), enabled, staleTime: Infinity });
}

function useWikiMutation<V, R = unknown>(fn: (variables: V) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: async () => {
      await Promise.all(['wiki-tree', 'wiki-page', 'wiki-revisions', 'search'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
    },
  });
}

export const useCreateWikiPage = (projectId: number) => useWikiMutation((input: { title: string; content?: string; parentId?: number | null }) => api.post<WikiPageDetail>(`/projects/${projectId}/wiki`, input));
export const useUpdateWikiPage = (id: number) => useWikiMutation((input: { title?: string; content?: string; parentId?: number | null; expectedUpdatedAt?: string }) => api.patch<WikiPageDetail>(`/wiki/${id}`, input));
export const useDeleteWikiPage = () => useWikiMutation((id: number) => api.delete(`/wiki/${id}`));
export const useRestoreRevision = (id: number) => useWikiMutation((revisionId: number) => api.post<WikiPageDetail>(`/wiki/${id}/revisions/${revisionId}/restore`));
