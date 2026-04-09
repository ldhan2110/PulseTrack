import { useMemo } from 'react';
import { useAuth } from '../auth/useAuth';
import { useMembers } from './useMembers';
import { hasPermission, type RolePermissions } from '../lib/permissions';

interface PermissionsResult {
  permissions: RolePermissions | null;
  isLoading: boolean;
  can: (area: string, action: string) => boolean;
  isSystemRole: boolean;
}

export function usePermissions(projectId: string): PermissionsResult {
  const { user } = useAuth();
  const { data: members, isLoading } = useMembers(projectId);

  const member = members?.find((m) => m.userId === user?.id);
  const permissions = (member?.customRole?.permissions as RolePermissions) ?? null;
  const isSystemRole = member?.customRole?.isSystem ?? false;

  const can = useMemo(() => {
    return (area: string, action: string): boolean => {
      if (isSystemRole) return true;
      return hasPermission(permissions, area, action);
    };
  }, [permissions, isSystemRole]);

  return { permissions, isLoading, can, isSystemRole };
}
