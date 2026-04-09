import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { CreateTestCasePayload, UpdateTestCasePayload } from '../lib/types';

export function useTestCases(projectId: string, filters?: Record<string, string>) {
  return useQuery({
    queryKey: ['test-cases', projectId, filters],
    queryFn: () => api.getTestCases(projectId, filters),
    enabled: !!projectId,
  });
}

export function useTestCase(projectId: string, testCaseId: string) {
  return useQuery({
    queryKey: ['test-case', projectId, testCaseId],
    queryFn: () => api.getTestCase(projectId, testCaseId),
    enabled: !!projectId && !!testCaseId,
  });
}

export function useTestCaseByKey(projectId: string, testCaseKey: string) {
  return useQuery({
    queryKey: ['test-case-by-key', projectId, testCaseKey],
    queryFn: () => api.getTestCaseByKey(projectId, testCaseKey),
    enabled: !!projectId && !!testCaseKey,
  });
}

export function useCreateTestCase(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTestCasePayload) => api.createTestCase(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
      toast.success('Test case created');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUpdateTestCase(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ testCaseId, data }: { testCaseId: string; data: UpdateTestCasePayload }) =>
      api.updateTestCase(projectId, testCaseId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['test-case', projectId, variables.testCaseId] });
      void queryClient.invalidateQueries({ queryKey: ['test-case-by-key', projectId] });
      toast.success('Test case updated');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useDeleteTestCase(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (testCaseId: string) => api.deleteTestCase(projectId, testCaseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['test-case-by-key', projectId] });
      toast.success('Test case deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
