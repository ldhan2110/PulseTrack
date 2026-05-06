import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// TODO: implement — add proper api methods when backend is ready

export function useTestExecutions(projectId: string) {
  return useQuery({
    queryKey: ['test-executions', projectId],
    queryFn: () => (api as any).getTestExecutions?.(projectId) ?? [],
    enabled: !!projectId,
  });
}

export function useTestExecution(projectId: string, executionId: string) {
  return useQuery({
    queryKey: ['test-execution', projectId, executionId],
    queryFn: () => (api as any).getTestExecution?.(projectId, executionId) ?? null,
    enabled: !!projectId && !!executionId,
  });
}

export function useTestExecutionByKey(projectId: string, executionKey: string) {
  return useQuery({
    queryKey: ['test-execution-key', projectId, executionKey],
    queryFn: () => (api as any).getTestExecutionByKey?.(projectId, executionKey) ?? null,
    enabled: !!projectId && !!executionKey,
  });
}

export function useBulkDeleteTestExecutions(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[]) => (api as any).bulkDeleteTestExecutions?.(projectId, ids) ?? Promise.resolve(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-executions', projectId] });
    },
  });
}

export function useDeleteTestExecution(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => (api as any).deleteTestExecution?.(projectId, id) ?? Promise.resolve(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-executions', projectId] });
    },
  });
}

export function useUploadExecutionEvidence(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { executionCaseId: string; file: File }) =>
      (api as any).uploadExecutionEvidence?.(projectId, params.executionCaseId, params.file) ?? Promise.resolve(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-executions', projectId] });
    },
  });
}

export function useDeleteExecutionEvidence(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      (api as any).deleteExecutionEvidence?.(projectId, attachmentId) ?? Promise.resolve(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-executions', projectId] });
    },
  });
}
