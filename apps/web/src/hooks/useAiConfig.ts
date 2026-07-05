import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { UpsertAiConfigPayload, UpdateProjectContextPayload } from '../lib/types';

export function useAiConfig(projectId: string) {
  return useQuery({
    queryKey: ['aiConfig', projectId],
    queryFn: () => api.getAiConfig(projectId),
    enabled: !!projectId,
  });
}

export function useUpsertAiConfig(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertAiConfigPayload) => api.upsertAiConfig(projectId, data),
    onSuccess: () => {
      toast.success('AI configuration saved');
      return queryClient.invalidateQueries({ queryKey: ['aiConfig', projectId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save AI configuration');
    },
  });
}

export function useUpdateProjectContext(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProjectContextPayload) =>
      api.updateProjectContext(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['aiConfig', projectId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update project context');
    },
  });
}

export function useGenerateProjectContext(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.generateProjectContext(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['aiConfig', projectId] });
      toast.success('Project context generated');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to generate project context');
    },
  });
}
