import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TestCase, CreateTestCasePayload, UpdateTestCasePayload } from '@/lib/types';

// TODO: implement — add proper api methods when backend is ready

export function useTestCases(projectId: string, filters?: Record<string, string>) {
  return useQuery<TestCase[]>({
    queryKey: ['test-cases', projectId, filters],
    queryFn: () => (api as any).getTestCases?.(projectId, filters) ?? ([] as TestCase[]),
    enabled: !!projectId,
  });
}

export function useTestCaseByKey(projectId: string, caseKey: string) {
  return useQuery<TestCase | null>({
    queryKey: ['test-case-key', projectId, caseKey],
    queryFn: () => (api as any).getTestCaseByKey?.(projectId, caseKey) ?? null,
    enabled: !!projectId && !!caseKey,
  });
}

export function useCreateTestCase(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTestCasePayload) => (api as any).createTestCase?.(projectId, data) ?? Promise.resolve(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
    },
  });
}

export function useUpdateTestCase(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { testCaseId: string; data: UpdateTestCasePayload } | (Partial<TestCase> & { id: string })) => {
      const id = 'testCaseId' in params ? params.testCaseId : params.id;
      const data = 'data' in params ? params.data : params;
      return (api as any).updateTestCase?.(projectId, id, data) ?? Promise.resolve();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
    },
  });
}

export function useDeleteTestCase(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => (api as any).deleteTestCase?.(projectId, id) ?? Promise.resolve(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
    },
  });
}

export function useBulkDeleteTestCases(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => (api as any).bulkDeleteTestCases?.(projectId, ids) ?? Promise.resolve(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
    },
  });
}
