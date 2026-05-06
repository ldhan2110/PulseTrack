import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { BulkImportTestCaseItem } from '@/lib/types';

// TODO: implement
export function useImportTestCases(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { items: BulkImportTestCaseItem[] }) =>
      (api as any).importTestCases?.(projectId, data.items) ?? Promise.resolve(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
    },
  });
}
