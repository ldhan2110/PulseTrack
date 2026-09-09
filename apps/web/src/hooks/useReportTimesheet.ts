import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

// from/to are ISO date strings (yyyy-MM-dd). Disabled until a project + range are known.
export function useReportTimesheet(projectId: string, from?: string, to?: string) {
  return useQuery({
    queryKey: ['report-timesheet', projectId, from, to],
    queryFn: () => api.getReportTimesheet(projectId, from!, to!),
    enabled: !!projectId && !!from && !!to,
  });
}
