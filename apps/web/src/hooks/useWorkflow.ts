import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { SaveWorkflowPayload, WorkflowData, WorkflowKind, WorkflowStatus } from '../lib/types';

export function useWorkflow(projectId: string, kind: WorkflowKind = 'TASK') {
  return useQuery({
    queryKey: ['workflow', projectId, kind],
    queryFn: () => api.getWorkflow(projectId, kind),
    enabled: !!projectId,
  });
}

export function useSaveWorkflow(projectId: string, kind: WorkflowKind = 'TASK') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: SaveWorkflowPayload) => api.saveWorkflow(projectId, { ...data, kind }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['workflow', projectId, kind] });
      if (kind === 'TASK') {
        void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      } else {
        void queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      }
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
    .filter((s): s is WorkflowStatus => s !== undefined);
}
