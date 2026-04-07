import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useSocket } from '../socket/useSocket';
import type { Project } from '../lib/types';

export function useMembershipSync() {
  const socket = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!socket) return;

    function onMemberRemoved({ projectId }: { projectId: string }) {
      // 1. Read the cached projects list to find the prefix for this projectId
      const projects = queryClient.getQueryData<Project[]>(['projects']);
      const project = projects?.find((p) => p.id === projectId);
      const prefix = project?.prefix ?? projectId;

      // 2. Invalidate queries
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] });

      // 3. If currently viewing this project, redirect home with toast
      if (location.pathname.startsWith(`/projects/${prefix}`)) {
        navigate('/');
        toast.warning('You were removed from this project');
      }
    }

    function onMemberAdded({ projectId }: { projectId: string; projectName: string }) {
      // Silently update the sidebar — just invalidate projects list
      void queryClient.invalidateQueries({ queryKey: ['projects'] });
      void queryClient.invalidateQueries({ queryKey: ['project', projectId] });
    }

    socket.on('member:removed', onMemberRemoved);
    socket.on('member:added', onMemberAdded);

    return () => {
      socket.off('member:removed', onMemberRemoved);
      socket.off('member:added', onMemberAdded);
    };
  }, [socket, navigate, location.pathname, queryClient]);
}
