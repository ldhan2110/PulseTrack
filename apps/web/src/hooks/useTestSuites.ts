import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { CreateTestSuitePayload, UpdateTestSuitePayload } from '../lib/types';

export function useTestSuites(projectId: string) {
  return useQuery({
    queryKey: ['test-suites', projectId],
    queryFn: () => api.getTestSuites(projectId),
    enabled: !!projectId,
  });
}

export function useTestSuite(projectId: string, suiteId: string) {
  return useQuery({
    queryKey: ['test-suite', projectId, suiteId],
    queryFn: () => api.getTestSuite(projectId, suiteId),
    enabled: !!projectId && !!suiteId,
  });
}

export function useCreateTestSuite(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTestSuitePayload) => api.createTestSuite(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] });
      toast.success('Test suite created');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUpdateTestSuite(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ suiteId, data }: { suiteId: string; data: UpdateTestSuitePayload }) =>
      api.updateTestSuite(projectId, suiteId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['test-suite', projectId, variables.suiteId] });
      toast.success('Test suite updated');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useDeleteTestSuite(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (suiteId: string) => api.deleteTestSuite(projectId, suiteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-suites', projectId] });
      toast.success('Test suite deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
