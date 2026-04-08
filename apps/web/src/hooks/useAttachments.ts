import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';

export function useAttachments(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['attachments', projectId, taskId],
    queryFn: () => api.getAttachments(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });
}

export function useUploadAttachment(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.uploadAttachment(projectId, taskId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attachments', projectId, taskId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useDeleteAttachment(projectId: string, taskId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      api.deleteAttachment(projectId, taskId, attachmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['attachments', projectId, taskId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
