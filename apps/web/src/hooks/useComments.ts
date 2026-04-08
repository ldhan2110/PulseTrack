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

// ─── Bug Comments ──────────────────────────────────────────────────────────

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
    mutationFn: (content: string) => api.createBugComment(projectId, bugId, { content }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bug-comments', projectId, bugId] });
    },
    onError: (err: Error) => { toast.error(err.message); },
  });
}

export function useCreateBugReply(projectId: string, bugId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      api.createBugReply(projectId, bugId, commentId, { content }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bug-comments', projectId, bugId] });
    },
    onError: (err: Error) => { toast.error(err.message); },
  });
}

export function useDeleteBugComment(projectId: string, bugId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (commentId: string) => api.deleteBugComment(projectId, bugId, commentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bug-comments', projectId, bugId] });
    },
    onError: (err: Error) => { toast.error(err.message); },
  });
}

export function useUpdateBugComment(projectId: string, bugId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ commentId, content }: { commentId: string; content: string }) =>
      api.updateBugComment(projectId, bugId, commentId, { content }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bug-comments', projectId, bugId] });
      toast.success('Comment updated');
    },
    onError: (err: Error) => { toast.error(err.message); },
  });
}
