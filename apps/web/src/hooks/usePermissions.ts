import { useMembers } from './useMembers';
import { useAuth } from '../auth/useAuth';
import { hasPermission } from '../lib/permissions';

export function usePermissions(projectId: string) {
  const { user } = useAuth();
  const { data: members, isLoading } = useMembers(projectId);

  const role = members?.find((m) => m.userId === user?.id)?.customRole;

  const can = (area: string, action: string) => {
    // Fail closed while members load or when the member/role is unknown.
    if (isLoading || !role) return false;
    if (role.isSystem) return true;
    return hasPermission(role.permissions, area, action);
  };

  return { can };
}
