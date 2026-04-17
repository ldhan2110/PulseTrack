import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { CreateTestExecutionPayload } from '../lib/types';

export function useTestExecutions(projectId: string) {
  return useQuery({
    queryKey: ['test-executions', projectId],
    queryFn: () => api.getTestExecutions(projectId),
    enabled: !!projectId,
  });
}

export function useTestExecution(projectId: string, executionId: string) {
  return useQuery({
    queryKey: ['test-execution', projectId, executionId],
    queryFn: () => api.getTestExecution(projectId, executionId),
    enabled: !!projectId && !!executionId,
  });
}

export function useTestExecutionByKey(projectId: string, executionKey: string) {
  return useQuery({
    queryKey: ['test-execution-by-key', projectId, executionKey],
    queryFn: () => api.getTestExecutionByKey(projectId, executionKey),
    enabled: !!projectId && !!executionKey,
  });
}

export function useCreateTestExecution(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTestExecutionPayload) => api.createTestExecution(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-executions', projectId] });
      toast.success('Test execution created');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUpdateExecutionCaseResult(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ executionCaseId, data }: { executionCaseId: string; data: { result: string; notes?: string } }) =>
      api.updateExecutionCaseResult(projectId, executionCaseId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-execution', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['test-execution-by-key', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['test-executions', projectId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUploadExecutionEvidence(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ executionCaseId, file }: { executionCaseId: string; file: File }) =>
      api.uploadExecutionEvidence(projectId, executionCaseId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-execution', projectId] });
      toast.success('Evidence uploaded');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useDeleteExecutionEvidence(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => api.deleteExecutionEvidence(projectId, attachmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-execution', projectId] });
      toast.success('Evidence deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useDeleteTestExecution(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (executionId: string) => api.deleteTestExecution(projectId, executionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-executions', projectId] });
      toast.success('Test execution deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useBulkDeleteTestExecutions(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.bulkDeleteTestExecutions(projectId, ids),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['test-executions', projectId] });
      toast.success(`Deleted ${data.deleted} test execution${data.deleted !== 1 ? 's' : ''}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
