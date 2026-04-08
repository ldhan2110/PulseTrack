import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { Task } from '../lib/types';

export function useMyTasks() {
  return useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => api.getMyTasks(),
  });
}

export function useDeleteMyTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ projectId, taskId }: { projectId: string; taskId: string }) =>
      api.deleteTask(projectId, taskId),
    onSuccess: (_data, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      toast.success('Task deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUpdateMyTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ task, workflowStatusId }: { task: Task; workflowStatusId: string }) =>
      api.updateTask(task.projectId, task.id, { workflowStatusId }),
    onMutate: async ({ task, workflowStatusId }) => {
      await queryClient.cancelQueries({ queryKey: ['my-tasks'] });
      const previousTasks = queryClient.getQueryData<Task[]>(['my-tasks']);
      queryClient.setQueryData<Task[]>(['my-tasks'], (old) =>
        old?.map((t) => (t.id === task.id ? { ...t, workflowStatusId } : t)) ?? [],
      );
      return { previousTasks };
    },
    onError: (err: Error, _vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['my-tasks'], context.previousTasks);
      }
      toast.error(err.message);
    },
    onSettled: (_data, _error, { task }) => {
      void queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', task.projectId] });
      void queryClient.invalidateQueries({ queryKey: ['task', task.projectId, task.id] });
      void queryClient.invalidateQueries({ queryKey: ['task-by-key', task.projectId] });
      void queryClient.invalidateQueries({ queryKey: ['task-history', task.projectId, task.id] });
    },
    onSuccess: () => {
      toast.success('Status updated');
    },
  });
}
