import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { CreateBugPayload, UpdateBugPayload } from '../lib/types';

export function useBugs(projectId: string) {
  return useQuery({
    queryKey: ['bugs', projectId],
    queryFn: () => api.getBugs(projectId),
    enabled: !!projectId,
  });
}

export function useBug(projectId: string, bugId: string) {
  return useQuery({
    queryKey: ['bug', projectId, bugId],
    queryFn: () => api.getBug(projectId, bugId),
    enabled: !!projectId && !!bugId,
  });
}

export function useCreateBug(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBugPayload) => api.createBug(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      toast.success('Bug reported');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUpdateBug(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bugId, data }: { bugId: string; data: UpdateBugPayload }) =>
      api.updateBug(projectId, bugId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      toast.success('Bug updated');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useDeleteBug(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bugId: string) => api.deleteBug(projectId, bugId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      toast.success('Bug deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
