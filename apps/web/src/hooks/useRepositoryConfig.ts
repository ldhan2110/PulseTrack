import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { UpsertRepositoryConfigPayload } from '../lib/types';

export function useRepositoryConfig(projectId: string) {
  return useQuery({
    queryKey: ['repositoryConfig', projectId],
    queryFn: () => api.getRepositoryConfig(projectId),
    enabled: !!projectId,
    refetchInterval: (query) => {
      const status = query.state.data?.cloneStatus;
      return status === 'cloning' ? 3000 : false;
    },
  });
}

export function useUpsertRepositoryConfig(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertRepositoryConfigPayload) =>
      api.upsertRepositoryConfig(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['repositoryConfig', projectId] });
      toast.success('Repository settings saved. Cloning started...');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save repository settings');
    },
  });
}

export function useDeleteRepositoryConfig(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteRepositoryConfig(projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['repositoryConfig', projectId] });
      toast.success('Repository config removed');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
