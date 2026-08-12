import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';

export function useTestAutomation(testCaseId: string) {
  return useQuery({
    queryKey: ['test-automation', testCaseId],
    queryFn: () => api.getAutomation(testCaseId),
    enabled: !!testCaseId,
  });
}

export function useUpsertAutomation(testCaseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { script: string; baseUrl?: string; timeoutMs?: number }) =>
      api.upsertAutomation(testCaseId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-automation', testCaseId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useGenerateScript(testCaseId: string) {
  return useMutation({
    mutationFn: (targetUrl: string) =>
      api.generateAutomationScript(testCaseId, targetUrl),
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useDeleteAutomation(testCaseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteAutomation(testCaseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-automation', testCaseId] });
      toast.success('Automation script deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
