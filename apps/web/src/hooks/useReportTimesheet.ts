import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

// from/to are ISO date strings (yyyy-MM-dd). Disabled until a project + range are known.
export function useReportTimesheet(
  projectId: string,
  from?: string,
  to?: string,
  filters: { userIds?: string[]; ticket?: string; typeIds?: string[] } = {},
) {
  return useQuery({
    queryKey: ['report-timesheet', projectId, from, to, filters.userIds, filters.ticket, filters.typeIds],
    queryFn: () => api.getReportTimesheet(projectId, from!, to!, filters),
    enabled: !!projectId && !!from && !!to,
  });
}
