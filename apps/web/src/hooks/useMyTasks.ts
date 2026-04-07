import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { Task, TaskStatus } from '../lib/types';

export function useMyTasks() {
  return useQuery({
    queryKey: ['my-tasks'],
    queryFn: () => api.getMyTasks(),
  });
}

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  IN_PROGRESS: 'In Progress',
  DONE: 'Done',
};

export function useUpdateMyTaskStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ task, status }: { task: Task; status: TaskStatus }) =>
      api.updateTask(task.projectId, task.id, { status }),
    onMutate: async ({ task, status }) => {
      await queryClient.cancelQueries({ queryKey: ['my-tasks'] });
      const previousTasks = queryClient.getQueryData<Task[]>(['my-tasks']);
      queryClient.setQueryData<Task[]>(['my-tasks'], (old) =>
        old?.map((t) => (t.id === task.id ? { ...t, status } : t)) ?? [],
      );
      return { previousTasks };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousTasks) {
        queryClient.setQueryData(['my-tasks'], context.previousTasks);
      }
      toast.error('Something went wrong. Please try again.');
    },
    onSettled: (_data, _error, { task }) => {
      void queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', task.projectId] });
      void queryClient.invalidateQueries({ queryKey: ['task', task.projectId, task.id] });
      void queryClient.invalidateQueries({ queryKey: ['task-by-key', task.projectId] });
      void queryClient.invalidateQueries({ queryKey: ['task-history', task.projectId, task.id] });
    },
    onSuccess: (_data, { status }) => {
      toast.success(`Moved to ${STATUS_LABELS[status] ?? status}`);
    },
  });
}
