import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { UpsertReportConfigPayload } from '../lib/types';

export function useReportConfig(projectId: string) {
  return useQuery({
    queryKey: ['reportConfig', projectId],
    queryFn: () => api.getReportConfig(projectId),
    enabled: !!projectId,
  });
}

export function useUpsertReportConfig(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertReportConfigPayload) =>
      api.upsertReportConfig(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reportConfig', projectId] });
      toast.success('Report settings saved');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save report settings');
    },
  });
}

export function useTestReport(projectId: string) {
  return useMutation({
    mutationFn: () => api.testReportConfig(projectId),
    onSuccess: (data: { report: { totalTasks: number; totalMembers: number }; results: { channel: string; status: string; detail?: string }[] }) => {
      const summary = data.results.map((r) => `${r.channel}: ${r.status}${r.detail ? ` (${r.detail})` : ''}`).join(', ');
      toast.success(`Test report sent — ${summary}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send test report');
    },
  });
}

export function useServerTimezone(projectId: string) {
  return useQuery({
    queryKey: ['serverTimezone'],
    queryFn: () => api.getServerTimezone(projectId),
    enabled: !!projectId,
    staleTime: Infinity,
  });
}
