import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useDashboard(projectId: string) {
  return useQuery({
    queryKey: ['dashboard', projectId],
    queryFn: () => api.getDashboard(projectId),
    enabled: !!projectId,
  });
}
