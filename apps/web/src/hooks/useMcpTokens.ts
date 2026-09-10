import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { CreateMcpTokenPayload } from '../lib/types';

export function useMcpTokens(projectId: string) {
  return useQuery({
    queryKey: ['mcpTokens', projectId],
    queryFn: () => api.mcpTokens.list(projectId),
    enabled: !!projectId,
  });
}

export function useCreateMcpToken(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMcpTokenPayload) => api.mcpTokens.create(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mcpTokens', projectId] });
      toast.success('Token created');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create token');
    },
  });
}

export function useRevokeMcpToken(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.mcpTokens.revoke(projectId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['mcpTokens', projectId] });
      toast.success('Token revoked');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to revoke token');
    },
  });
}
