import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useSocket } from '../socket/useSocket';

/**
 * Listens for real-time task events via Socket.IO and invalidates
 * the relevant React Query caches so other users see changes live.
 */
export function useTaskSync(projectId?: string) {
  const socket = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket || !projectId) return;

    socket.emit('join-project', projectId);

    function onTaskCreated({ projectId: pid }: { projectId: string }) {
      void queryClient.invalidateQueries({ queryKey: ['tasks', pid] });
      void queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', pid] });
    }

    function onTaskUpdated({ projectId: pid, taskId }: { projectId: string; taskId: string }) {
      void queryClient.invalidateQueries({ queryKey: ['tasks', pid] });
      void queryClient.invalidateQueries({ queryKey: ['task', pid, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['task-by-key', pid] });
      void queryClient.invalidateQueries({ queryKey: ['task-history', pid, taskId] });
      void queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', pid] });
    }

    function onTaskDeleted({ projectId: pid }: { projectId: string }) {
      void queryClient.invalidateQueries({ queryKey: ['tasks', pid] });
      void queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
      void queryClient.invalidateQueries({ queryKey: ['dashboard', pid] });
    }

    socket.on('task:created', onTaskCreated);
    socket.on('task:updated', onTaskUpdated);
    socket.on('task:deleted', onTaskDeleted);

    return () => {
      socket.emit('leave-project', projectId);
      socket.off('task:created', onTaskCreated);
      socket.off('task:updated', onTaskUpdated);
      socket.off('task:deleted', onTaskDeleted);
    };
  }, [socket, projectId, queryClient]);
}

/**
 * Listens for user-scoped task events (e.g. assignee changes)
 * to keep the My Tasks page in sync across browsers.
 */
export function useMyTaskSync() {
  const socket = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    function onTaskUpdated() {
      void queryClient.invalidateQueries({ queryKey: ['my-tasks'] });
    }

    socket.on('task:updated', onTaskUpdated);

    return () => {
      socket.off('task:updated', onTaskUpdated);
    };
  }, [socket, queryClient]);
}
