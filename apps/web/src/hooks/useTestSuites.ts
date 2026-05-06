import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TestSuite } from '@/lib/types';

// TODO: implement
export function useTestSuite(projectId: string, suiteId: string) {
  return useQuery({
    queryKey: ['test-suite', projectId, suiteId],
    queryFn: () => (api as any).getTestSuite?.(projectId, suiteId) ?? null,
    enabled: !!projectId && !!suiteId,
  });
}

export function useTestSuites(projectId: string, moduleId?: string) {
  return useQuery<TestSuite[]>({
    queryKey: ['test-suites', projectId, moduleId],
    queryFn: () => (api as any).getTestSuites?.(projectId, moduleId) ?? [],
    enabled: !!projectId,
  });
}

export function useCreateTestSuite(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; moduleId: string }) =>
      (api as any).createTestSuite?.(projectId, data) ?? Promise.resolve(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] });
    },
  });
}

export function useUpdateTestSuite(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { suiteId: string; data: { name?: string } }) =>
      (api as any).updateTestSuite?.(projectId, params.suiteId, params.data) ?? Promise.resolve(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] });
    },
  });
}

export function useDeleteTestSuite(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (suiteId: string) =>
      (api as any).deleteTestSuite?.(projectId, suiteId) ?? Promise.resolve(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] });
    },
  });
}
