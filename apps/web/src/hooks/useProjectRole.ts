import { useAuth } from '../auth/useAuth';
import { useMembers } from './useMembers';
import type { ProjectRole } from '../lib/types';

interface ProjectRoleResult {
  role: ProjectRole | null;
  isLoading: boolean;
  canEdit: boolean;
  canManage: boolean;
}

export function useProjectRole(projectId: string): ProjectRoleResult {
  const { user } = useAuth();
  const { data: members, isLoading } = useMembers(projectId);

  const member = members?.find((m) => m.userId === user?.id);
  const role = member?.role ?? null;

  return {
    role,
    isLoading,
    canEdit: role !== null,
    canManage: role === 'pm',
  };
}
