import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Caller debounces `q` (200ms) before passing it in. Fires only at >= 2 chars.
export function useGlobalSearch(q: string) {
  return useQuery({
    queryKey: ['global-search', q],
    queryFn: () => api.globalSearch(q),
    enabled: q.trim().length >= 2,
  });
}
