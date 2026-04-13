import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { UpsertPlannerAiConfigPayload } from '../lib/types';

export function usePlannerAiConfig(projectId: string) {
  return useQuery({
    queryKey: ['plannerAiConfig', projectId],
    queryFn: () => api.getPlannerAiConfig(projectId),
    enabled: !!projectId,
  });
}

export function useUpsertPlannerAiConfig(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertPlannerAiConfigPayload) =>
      api.upsertPlannerAiConfig(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['plannerAiConfig', projectId] });
      toast.success('Planner AI configuration saved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save planner AI configuration');
    },
  });
}
