import type { ReactNode } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import type { PermissionArea, PermissionAction } from '@/lib/permissions';

interface Props {
  projectId: string;
  area: PermissionArea;
  action: PermissionAction;
  children: ReactNode;
  /** Rendered when the permission is absent. Default: nothing. */
  fallback?: ReactNode;
}

/** Renders children only when the current member's role grants `area.action`. */
export function PermissionGate({ projectId, area, action, children, fallback = null }: Props) {
  const { can } = usePermissions(projectId);
  return <>{can(area as string, action) ? children : fallback}</>;
}
