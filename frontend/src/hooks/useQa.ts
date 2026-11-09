import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import type { Environment, Priority, TestCase, TestResultStatus, TestResultView, TestRunDetail, TestRunSummary } from '../types/api';

export function useTestCases(projectId: number, includeArchived = false) {
  return useQuery({ queryKey: ['test-cases', projectId, includeArchived], queryFn: () => api.get<TestCase[]>(`/projects/${projectId}/test-cases`, { includeArchived }), enabled: !Number.isNaN(projectId) });
}

export function useTestRuns(projectId: number) {
  return useQuery({ queryKey: ['test-runs', projectId], queryFn: () => api.get<TestRunSummary[]>(`/projects/${projectId}/test-runs`), enabled: !Number.isNaN(projectId) });
}

export function useTestRun(id: number) {
  return useQuery({ queryKey: ['test-run', id], queryFn: () => api.get<TestRunDetail>(`/test-runs/${id}`), enabled: !Number.isNaN(id) });
}

function useQaMutation<V, R = unknown>(fn: (variables: V) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSettled: async () => {
      // Test fail tự sinh Bug nên bảng việc/dashboard cũng đổi
      await Promise.all(['test-cases', 'test-runs', 'test-run', 'tasks', 'board', 'dashboard', 'backlog', 'releases', 'release'].map((k) => queryClient.invalidateQueries({ queryKey: [k] })));
    },
  });
}

export interface TestCaseInput {
  title: string;
  preconditions?: string | null;
  steps: string;
  expected: string;
  priority?: Priority;
}

export const useCreateTestCase = (projectId: number) => useQaMutation((input: TestCaseInput) => api.post<TestCase>(`/projects/${projectId}/test-cases`, input));
export const useUpdateTestCase = () => useQaMutation(({ id, ...input }: { id: number } & Partial<TestCaseInput> & { archived?: boolean }) => api.patch<TestCase>(`/test-cases/${id}`, input));
export const useDeleteTestCase = () => useQaMutation((id: number) => api.delete<{ archived: boolean }>(`/test-cases/${id}`));
export const useCreateTestRun = (projectId: number) =>
  useQaMutation((input: { name: string; environment?: Environment | null; releaseId?: number | null; testCaseIds?: number[] }) => api.post<TestRunSummary>(`/projects/${projectId}/test-runs`, input));
export const useCloseTestRun = () => useQaMutation((id: number) => api.post<TestRunSummary>(`/test-runs/${id}/close`));
export const useExecuteResult = () =>
  useQaMutation(({ id, status, note }: { id: number; status: TestResultStatus; note?: string | null }) =>
    api.patch<TestResultView & { createdBug: { id: number; title: string } | null }>(`/test-results/${id}`, { status, note: note ?? null }),
  );
