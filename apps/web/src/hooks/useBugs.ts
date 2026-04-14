import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { CreateBugPayload, UpdateBugPayload } from '../lib/types';

export function useBugs(projectId: string) {
  return useQuery({
    queryKey: ['bugs', projectId],
    queryFn: () => api.getBugs(projectId),
    enabled: !!projectId,
  });
}

export function useBug(projectId: string, bugId: string) {
  return useQuery({
    queryKey: ['bug', projectId, bugId],
    queryFn: () => api.getBug(projectId, bugId),
    enabled: !!projectId && !!bugId,
  });
}

export function useBugByKey(projectId: string, bugKey: string) {
  return useQuery({
    queryKey: ['bug-by-key', projectId, bugKey],
    queryFn: () => api.getBugByKey(projectId, bugKey),
    enabled: !!projectId && !!bugKey,
  });
}

export function useCreateBug(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateBugPayload) => api.createBug(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', projectId] });
      toast.success('Bug reported');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUpdateBug(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bugId, data }: { bugId: string; data: UpdateBugPayload }) =>
      api.updateBug(projectId, bugId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['bug', projectId, variables.bugId] });
      void queryClient.invalidateQueries({ queryKey: ['bug-by-key', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['bug-history', projectId, variables.bugId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', projectId] });
      toast.success('Bug updated');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useDeleteBug(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bugId: string) => api.deleteBug(projectId, bugId),
    onSuccess: (_data, bugId) => {
      void queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['bug', projectId, bugId] });
      void queryClient.invalidateQueries({ queryKey: ['bug-by-key', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', projectId] });
      toast.success('Bug deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useLinkBugTasks(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bugId, taskIds }: { bugId: string; taskIds: string[] }) =>
      api.linkBugTasks(projectId, bugId, taskIds),
    onSuccess: (_data, { bugId }) => {
      void queryClient.invalidateQueries({ queryKey: ['bug', projectId, bugId] });
      void queryClient.invalidateQueries({ queryKey: ['bug-by-key', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['task-bugs'] });
      toast.success('Tasks linked');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUnlinkBugTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bugId, taskId }: { bugId: string; taskId: string }) =>
      api.unlinkBugTask(projectId, bugId, taskId),
    onSuccess: (_data, { bugId }) => {
      void queryClient.invalidateQueries({ queryKey: ['bug', projectId, bugId] });
      void queryClient.invalidateQueries({ queryKey: ['bug-by-key', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['task-bugs'] });
      toast.success('Task unlinked');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useTaskBugs(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['task-bugs', projectId, taskId],
    queryFn: () => api.getTaskBugs(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });
}
