import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BulkImportTestCaseItem } from '@/lib/types';

export function useImportTestCases(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { items: BulkImportTestCaseItem[] }) =>
      api.bulkImportTestCases(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
    },
  });
}
