import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';

export function useComments(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['comments', projectId, taskId],
    queryFn: () => api.getComments(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });
}

export function useCreateComment(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (content: string) =>
      api.createComment(projectId, taskId, { content }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', projectId, taskId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useCreateReply(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      api.createReply(projectId, taskId, commentId, { content }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', projectId, taskId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useDeleteComment(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) =>
      api.deleteComment(projectId, taskId, commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', projectId, taskId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUpdateComment(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      api.updateComment(projectId, taskId, commentId, { content }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['comments', projectId, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['task-history', projectId, taskId] });
      toast.success('Comment updated');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
