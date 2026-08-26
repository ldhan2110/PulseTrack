import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { CreateRepositoryPayload } from '../lib/types';

export function useRepositories(projectId: string) {
  return useQuery({
    queryKey: ['repositories', projectId],
    queryFn: () => api.getRepositories(projectId),
    enabled: !!projectId,
    refetchInterval: (query) => {
      const busy = query.state.data?.some(
        (r) => r.cloneStatus === 'cloning' || r.indexStatus === 'indexing',
      );
      return busy ? 3000 : false;
    },
  });
}

// ponytail: compat shim for AI-fix / gating consumers that predate multi-repo;
// returns the project's first repository. Upgrade to a repo picker if those flows go multi-repo.
export function useRepositoryConfig(projectId: string) {
  const query = useRepositories(projectId);
  return { ...query, data: query.data?.[0] ?? null };
}

export function useAddRepository(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateRepositoryPayload) => api.addRepository(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['repositories', projectId] });
      toast.success('Repository added. Cloning started...');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add repository');
    },
  });
}

export function usePullRepository(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repositoryId: string) => api.pullRepository(projectId, repositoryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['repositories', projectId] });
      toast.success('Pulled. Re-indexing started...');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useRemoveRepository(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (repositoryId: string) => api.removeRepository(projectId, repositoryId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['repositories', projectId] });
      toast.success('Repository removed');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
