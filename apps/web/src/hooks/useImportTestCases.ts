import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { BulkImportTestCasesPayload } from '../lib/types';

export function useImportTestCases(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkImportTestCasesPayload) =>
      api.bulkImportTestCases(projectId, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['test-cases', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['test-modules', projectId] });
      const msg = result.modulesCreated.length > 0
        ? `Imported ${result.created} test cases (${result.modulesCreated.length} new module${result.modulesCreated.length > 1 ? 's' : ''} created)`
        : `Imported ${result.created} test cases`;
      toast.success(msg);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
