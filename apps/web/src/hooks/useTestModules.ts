import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { TestModule } from '@/lib/types';

// TODO: implement — add proper api methods when backend is ready
export function useTestModules(projectId: string) {
  return useQuery<TestModule[]>({
    queryKey: ['test-modules', projectId],
    queryFn: () => (api as any).getTestModules?.(projectId) ?? [],
    enabled: !!projectId,
  });
}

export function useCreateTestModule(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; parentId?: string }) =>
      (api as any).createTestModule?.(projectId, data) ?? Promise.resolve(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-modules', projectId] });
    },
  });
}

export function useUpdateTestModule(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (params: { moduleId: string; data: { name?: string } }) =>
      (api as any).updateTestModule?.(projectId, params.moduleId, params.data) ?? Promise.resolve(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-modules', projectId] });
    },
  });
}

export function useDeleteTestModule(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (moduleId: string) =>
      (api as any).deleteTestModule?.(projectId, moduleId) ?? Promise.resolve(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-modules', projectId] });
    },
  });
}

