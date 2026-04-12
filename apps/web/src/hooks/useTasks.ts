import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { Task, CreateTaskPayload, UpdateTaskPayload, CreateTimeLogPayload } from '../lib/types';

export function useTasks(projectId: string) {
  return useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api.getTasks(projectId),
    enabled: !!projectId,
  });
}

export function useTask(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['task', projectId, taskId],
    queryFn: () => api.getTask(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });
}

export function useTaskByKey(projectId: string, taskKey: string) {
  return useQuery({
    queryKey: ['task-by-key', projectId, taskKey],
    queryFn: () => api.getTaskByKey(projectId, taskKey),
    enabled: !!projectId && !!taskKey,
  });
}

export function useCreateTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTaskPayload) => api.createTask(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', projectId] });
      toast.success('Task created successfully');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUpdateTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: UpdateTaskPayload }) =>
      api.updateTask(projectId, taskId, data),
    onMutate: async ({ taskId, data }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', projectId] });
      const previousTasks = queryClient.getQueryData<Task[]>(['tasks', projectId]);
      queryClient.setQueryData<Task[]>(['tasks', projectId], (old) =>
        old?.map((t) => (t.id === taskId ? { ...t, ...data } : t)) ?? [],
      );
      const previousTask = queryClient.getQueryData(['task', projectId, taskId]);
      queryClient.setQueryData(['task', projectId, taskId], (old: Task | undefined) =>
        old ? { ...old, ...data } : old,
      );
      return { previousTasks, previousTask };
    },
    onError: (err: Error, { taskId }, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', projectId], context.previousTasks);
      }
      if (context?.previousTask) {
        queryClient.setQueryData(['task', projectId, taskId], context.previousTask);
      }
      toast.error(err.message);
    },
    onSettled: (_data, _error, { taskId }) => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['task-history', projectId, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', projectId] });
    },
    onSuccess: () => {
      toast.success('Task updated');
    },
  });
}

export function useDeleteTask(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId: string) => api.deleteTask(projectId, taskId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', projectId] });
      toast.success('Task deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUpdateTaskStatus(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, workflowStatusId }: { taskId: string; workflowStatusId: string }) =>
      api.updateTask(projectId, taskId, { workflowStatusId }),
    onMutate: async ({ taskId, workflowStatusId }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', projectId] });
      const previousTasks = queryClient.getQueryData<Task[]>(['tasks', projectId]);
      queryClient.setQueryData<Task[]>(['tasks', projectId], (old) =>
        old?.map((t) => (t.id === taskId ? { ...t, workflowStatusId } : t)) ?? [],
      );
      const previousTask = queryClient.getQueryData(['task', projectId, taskId]);
      queryClient.setQueryData(['task', projectId, taskId], (old: Task | undefined) =>
        old ? { ...old, workflowStatusId } : old,
      );
      return { previousTasks, previousTask };
    },
    onError: (err: Error, { taskId }, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', projectId], context.previousTasks);
      }
      if (context?.previousTask) {
        queryClient.setQueryData(['task', projectId, taskId], context.previousTask);
      }
      toast.error(err.message);
    },
    onSettled: (_data, _error, { taskId }) => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['task-history', projectId, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', projectId] });
    },
    onSuccess: () => {
      toast.success('Status updated');
    },
  });
}

export function useTimeLogs(projectId: string, taskId: string) {
  return useQuery({
    queryKey: ['time-logs', projectId, taskId],
    queryFn: () => api.getTimeLogs(projectId, taskId),
    enabled: !!projectId && !!taskId,
  });
}

export function useCreateTimeLog(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: CreateTimeLogPayload }) =>
      api.createTimeLog(projectId, taskId, data),
    onSuccess: (_data, { taskId }) => {
      void queryClient.invalidateQueries({ queryKey: ['time-logs', projectId, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['task-history', projectId, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', projectId] });
      toast.success('Time logged');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTimeLog(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, timeLogId }: { taskId: string; timeLogId: string }) =>
      api.deleteTimeLog(projectId, taskId, timeLogId),
    onSuccess: (_data, { taskId }) => {
      void queryClient.invalidateQueries({ queryKey: ['time-logs', projectId, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', projectId] });
      toast.success('Time log deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
