import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

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
    // Poll while any case is still running (server-side auto-run in progress)
    refetchInterval: (query) =>
      query.state.data?.cases?.some((c) => c.result === 'IN_PROGRESS') ? 3000 : false,
  });
}

export function useTestExecutionByKey(projectId: string, executionKey: string) {
  return useQuery({
    queryKey: ['test-execution-key', projectId, executionKey],
    queryFn: () => api.getTestExecutionByKey(projectId, executionKey),
    enabled: !!projectId && !!executionKey,
  });
}

export function useCreateTestExecution(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: import('@/lib/types').CreateTestExecutionPayload) =>
      api.createTestExecution(projectId, data),
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
    mutationFn: (params: { executionCaseId: string; data: { result: string; notes?: string } }) =>
      api.updateExecutionCaseResult(projectId, params.executionCaseId, params.data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-execution', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['test-execution-key', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['test-executions', projectId] });
    },
  });
}

export function useUpdateTestExecutionStatus(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { executionId: string; status: string }) =>
      api.updateTestExecutionStatus(projectId, params.executionId, params.status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-execution', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['test-executions', projectId] });
    },
  });
}

export function useBulkDeleteTestExecutions(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => api.bulkDeleteTestExecutions(projectId, ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-executions', projectId] });
    },
  });
}

export function useDeleteTestExecution(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteTestExecution(projectId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-executions', projectId] });
      toast.success('Test execution deleted');
    },
  });
}

export function useUploadExecutionEvidence(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { executionCaseId: string; file: File }) =>
      api.uploadExecutionEvidence(projectId, params.executionCaseId, params.file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-execution', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['test-execution-key', projectId] });
    },
  });
}

export function useDeleteExecutionEvidence(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      api.deleteExecutionEvidence(projectId, attachmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-execution', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['test-execution-key', projectId] });
    },
  });
}
