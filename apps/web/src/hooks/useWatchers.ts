import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { EntityType } from '../lib/types';

export function useWatchers(projectId: string, entityType: EntityType, entityId: string) {
  const isTask = entityType === 'TASK';
  return useQuery({
    queryKey: ['watchers', projectId, entityType, entityId],
    queryFn: () => isTask
      ? api.getTaskWatchers(projectId, entityId)
      : api.getBugWatchers(projectId, entityId),
    enabled: !!projectId && !!entityId,
  });
}

export function useAddWatchers(projectId: string, entityType: EntityType, entityId: string) {
  const qc = useQueryClient();
  const isTask = entityType === 'TASK';
  return useMutation({
    mutationFn: (userIds: string[]) => isTask
      ? api.addTaskWatchers(projectId, entityId, userIds)
      : api.addBugWatchers(projectId, entityId, userIds),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['watchers', projectId, entityType, entityId] });
      if (isTask) {
        void qc.invalidateQueries({ queryKey: ['task-history', projectId, entityId] });
      } else {
        void qc.invalidateQueries({ queryKey: ['bug-history', projectId, entityId] });
      }
      toast.success('Watcher added');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useRemoveWatcher(projectId: string, entityType: EntityType, entityId: string) {
  const qc = useQueryClient();
  const isTask = entityType === 'TASK';
  return useMutation({
    mutationFn: (userId: string) => isTask
      ? api.removeTaskWatcher(projectId, entityId, userId)
      : api.removeBugWatcher(projectId, entityId, userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['watchers', projectId, entityType, entityId] });
      if (isTask) {
        void qc.invalidateQueries({ queryKey: ['task-history', projectId, entityId] });
      } else {
        void qc.invalidateQueries({ queryKey: ['bug-history', projectId, entityId] });
      }
      toast.success('Watcher removed');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
