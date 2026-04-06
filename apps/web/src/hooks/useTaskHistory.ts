import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useTaskHistory(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['task-history', projectId, taskId],
    queryFn: () => api.getTaskHistory(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });
}
