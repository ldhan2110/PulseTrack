import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { Task, CreateTaskPayload, UpdateTaskPayload, TaskStatus } from '../lib/types';

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
      toast.success('Task created successfully');
    },
    onError: () => {
      toast.error('Something went wrong. Please try again.');
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
    onError: (_err, { taskId }, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', projectId], context.previousTasks);
      }
      if (context?.previousTask) {
        queryClient.setQueryData(['task', projectId, taskId], context.previousTask);
      }
      toast.error('Something went wrong. Please try again.');
    },
    onSettled: (_data, _error, { taskId }) => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['task-history', projectId, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
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
      toast.success('Task deleted');
    },
    onError: () => {
      toast.error('Something went wrong. Please try again.');
    },
  });
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  BACKLOG: 'Backlog',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  BLOCKED: 'Blocked',
};

export function useUpdateTaskStatus(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      api.updateTask(projectId, taskId, { status }),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', projectId] });
      const previousTasks = queryClient.getQueryData<Task[]>(['tasks', projectId]);
      queryClient.setQueryData<Task[]>(['tasks', projectId], (old) =>
        old?.map((t) => (t.id === taskId ? { ...t, status } : t)) ?? [],
      );
      const previousTask = queryClient.getQueryData(['task', projectId, taskId]);
      queryClient.setQueryData(['task', projectId, taskId], (old: Task | undefined) =>
        old ? { ...old, status } : old,
      );
      return { previousTasks, previousTask };
    },
    onError: (_err, { taskId }, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', projectId], context.previousTasks);
      }
      if (context?.previousTask) {
        queryClient.setQueryData(['task', projectId, taskId], context.previousTask);
      }
      toast.error('Something went wrong. Please try again.');
    },
    onSettled: (_data, _error, { taskId }) => {
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['task', projectId, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['task-history', projectId, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['task-by-key', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    },
    onSuccess: (_data, { status }) => {
      toast.success(`Moved to ${STATUS_LABELS[status]}`);
    },
  });
}
