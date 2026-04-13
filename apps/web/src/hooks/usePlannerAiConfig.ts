import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { UpsertPlannerAiConfigPayload } from '../lib/types';

export interface OpenRouterModel {
  id: string;
  name: string;
  pricing: { prompt: string; completion: string };
}

async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  const res = await fetch('https://openrouter.ai/api/v1/models');
  if (!res.ok) return [];
  const json = await res.json() as { data: OpenRouterModel[] };
  return json.data ?? [];
}

export function useOpenRouterModels() {
  return useQuery({
    queryKey: ['openrouter-models'],
    queryFn: fetchOpenRouterModels,
    staleTime: 60 * 60 * 1000, // 1 hour
    gcTime: 60 * 60 * 1000,
  });
}

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
