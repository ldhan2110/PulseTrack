import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export function useBugHistory(projectId: string, bugId: string) {
  return useQuery({
    queryKey: ['bug-history', projectId, bugId],
    queryFn: () => api.getBugHistory(projectId, bugId),
    enabled: !!projectId && !!bugId,
  });
}
