import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { CreateSavedFilterPayload, UpdateSavedFilterPayload } from '../lib/types';

export function useSavedFilters(projectId: string, entityType: 'task' | 'bug') {
  return useQuery({
    queryKey: ['saved-filters', projectId, entityType],
    queryFn: () => api.getSavedFilters(projectId, entityType),
    enabled: !!projectId,
  });
}

export function useCreateSavedFilter(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSavedFilterPayload) => api.createSavedFilter(projectId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['saved-filters', projectId, variables.entityType] });
      toast.success('Filter saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateSavedFilter(projectId: string, entityType: 'task' | 'bug') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSavedFilterPayload }) =>
      api.updateSavedFilter(projectId, id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['saved-filters', projectId, entityType] });
      toast.success('Filter updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteSavedFilter(projectId: string, entityType: 'task' | 'bug') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteSavedFilter(projectId, id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['saved-filters', projectId, entityType] });
      toast.success('Filter deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
