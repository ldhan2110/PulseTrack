import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useDashboard(projectId: string, timeFilter?: string) {
  const params = timeFilter && timeFilter !== 'all' ? `?timeFilter=${timeFilter}` : '';
  return useQuery({
    queryKey: ['dashboard', projectId, timeFilter],
    queryFn: () => api.getDashboard(projectId, params),
    enabled: !!projectId,
  });
}
