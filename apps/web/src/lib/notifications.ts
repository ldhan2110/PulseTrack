import type { Notification } from './types';

export function getNotificationUrl(notification: Notification): string | null {
  const metadata = notification.metadata as Record<string, unknown> | null;
  const projectPrefix = metadata?.projectPrefix as string | undefined;
  const entityKey = metadata?.entityKey as string | undefined;

  if (!projectPrefix || !entityKey) return null;

  const segment = notification.entityType === 'TASK' ? 'tasks' : 'bugs';
  return `/projects/${projectPrefix}/${segment}/${entityKey}`;
}
