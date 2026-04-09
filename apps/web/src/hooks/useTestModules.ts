import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';

export function useTestModules(projectId: string) {
  return useQuery({
    queryKey: ['test-modules', projectId],
    queryFn: () => api.getTestModules(projectId),
    enabled: !!projectId,
  });
}

export function useCreateTestModule(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; parentId?: string }) =>
      api.createTestModule(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-modules', projectId] });
      toast.success('Module created');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUpdateTestModule(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ moduleId, data }: { moduleId: string; data: { name?: string; position?: number; parentId?: string } }) =>
      api.updateTestModule(moduleId, projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-modules', projectId] });
      toast.success('Module updated');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useDeleteTestModule(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (moduleId: string) => api.deleteTestModule(moduleId, projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-modules', projectId] });
      toast.success('Module deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
