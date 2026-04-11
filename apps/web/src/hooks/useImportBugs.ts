import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { BulkImportBugsPayload } from '../lib/types';

export function useImportBugs(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkImportBugsPayload) =>
      api.bulkImportBugs(projectId, data),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      toast.success(`Imported ${result.created} bug${result.created !== 1 ? 's' : ''}`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
