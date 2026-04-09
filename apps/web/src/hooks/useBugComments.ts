import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';

export function useBugComments(projectId: string, bugId: string) {
  return useQuery({
    queryKey: ['bug-comments', projectId, bugId],
    queryFn: () => api.getBugComments(projectId, bugId),
    enabled: !!projectId && !!bugId,
  });
}

export function useCreateBugComment(projectId: string, bugId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      api.createBugComment(projectId, bugId, { content }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bug-comments', projectId, bugId] });
      void queryClient.invalidateQueries({ queryKey: ['bug-history', projectId, bugId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useCreateBugReply(projectId: string, bugId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      api.createBugReply(projectId, bugId, commentId, { content }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bug-comments', projectId, bugId] });
      void queryClient.invalidateQueries({ queryKey: ['bug-history', projectId, bugId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useDeleteBugComment(projectId: string, bugId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      api.deleteBugComment(projectId, bugId, commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bug-comments', projectId, bugId] });
      void queryClient.invalidateQueries({ queryKey: ['bug-history', projectId, bugId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUpdateBugComment(projectId: string, bugId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      api.updateBugComment(projectId, bugId, commentId, { content }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bug-comments', projectId, bugId] });
      void queryClient.invalidateQueries({ queryKey: ['bug-history', projectId, bugId] });
      toast.success('Comment updated');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
