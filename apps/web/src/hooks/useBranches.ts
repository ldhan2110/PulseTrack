import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { CreateBranchPayload, CreatePrPayload } from '../lib/types';

export function useTaskBranches(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['taskBranches', projectId, taskId],
    queryFn: () => api.getTaskBranches(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });
}

export function useCreateBranch(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBranchPayload) =>
      api.createTaskBranch(projectId, taskId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['taskBranches', projectId, taskId] });
      toast.success('Branch created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create branch');
    },
  });
}

export function useCreatePr(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePrPayload) =>
      api.createTaskPr(projectId, taskId, data),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['taskBranches', projectId, taskId] });
      toast.success(`PR/MR #${data.prNumber} created`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create PR/MR');
    },
  });
}
