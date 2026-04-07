import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { SaveWorkflowPayload, WorkflowData } from '../lib/types';

export function useWorkflow(projectId: string) {
  return useQuery({
    queryKey: ['workflow', projectId],
    queryFn: () => api.getWorkflow(projectId),
    enabled: !!projectId,
  });
}

export function useSaveWorkflow(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveWorkflowPayload) => api.saveWorkflow(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflow', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Workflow saved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save workflow');
    },
  });
}

export function useAllowedAssignees(projectId: string, statusId: string | null) {
  return useQuery({
    queryKey: ['allowed-assignees', projectId, statusId],
    queryFn: () => api.getAllowedAssignees(projectId, statusId!),
    enabled: !!projectId && !!statusId,
  });
}

export function useValidTransitions(workflow: WorkflowData | undefined, currentStatusId: string | null) {
  if (!workflow || !currentStatusId) return [];

  const currentStatus = workflow.statuses.find((s) => s.id === currentStatusId);
  if (!currentStatus) return [];

  return workflow.transitions
    .filter((t) => t.fromStatusKey === currentStatus.key)
    .map((t) => workflow.statuses.find((s) => s.key === t.toStatusKey))
    .filter(Boolean);
}
