import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { CreateSprintPayload, UpdateSprintPayload } from '../lib/types';

export function useSprints(projectId: string) {
  return useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => api.getSprints(projectId),
    enabled: !!projectId,
  });
}

export function useSprint(projectId: string, sprintId: string) {
  return useQuery({
    queryKey: ['sprint', projectId, sprintId],
    queryFn: () => api.getSprint(projectId, sprintId),
    enabled: !!projectId && !!sprintId,
  });
}

export function useCreateSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSprintPayload) => api.createSprint(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', projectId] });
      toast.success('Sprint created');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUpdateSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sprintId, data }: { sprintId: string; data: UpdateSprintPayload }) =>
      api.updateSprint(projectId, sprintId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', projectId] });
      toast.success('Sprint updated');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useActivateSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sprintId: string) => api.activateSprint(projectId, sprintId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', projectId] });
      toast.success('Sprint activated');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useCloseSprint(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sprintId: string) => api.closeSprint(projectId, sprintId),
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['sprints', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', projectId] });
      toast.success(`Sprint closed. ${data.movedToBacklog} tasks returned to backlog.`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
