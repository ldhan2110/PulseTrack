import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';

export function useBugAttachments(projectId: string, bugId: string) {
  return useQuery({
    queryKey: ['bug-attachments', projectId, bugId],
    queryFn: () => api.getBugAttachments(projectId, bugId),
    enabled: !!projectId && !!bugId,
  });
}

export function useUploadBugAttachment(projectId: string, bugId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => api.uploadBugAttachment(projectId, bugId, file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bug-attachments', projectId, bugId] });
      void queryClient.invalidateQueries({ queryKey: ['bug', projectId, bugId] });
      toast.success('File uploaded');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useDeleteBugAttachment(projectId: string, bugId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) => api.deleteBugAttachment(projectId, bugId, attachmentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bug-attachments', projectId, bugId] });
      void queryClient.invalidateQueries({ queryKey: ['bug', projectId, bugId] });
      toast.success('File deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
