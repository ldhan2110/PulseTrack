import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { Notification } from '@/lib/types';

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

interface NotificationItemProps {
  notification: Notification;
  onClick: (notification: Notification) => void;
}

export function NotificationItem({ notification, onClick }: NotificationItemProps) {
  const actor = notification.actor;
  const relTime = (() => {
    try { return formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true }); }
    catch { return notification.createdAt; }
  })();

  return (
    <button
      className={`flex items-start gap-2 w-full text-left px-3 py-2 hover:bg-muted/50 transition-colors ${
        !notification.isRead ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
      }`}
      onClick={() => onClick(notification)}
    >
      {!notification.isRead && (
        <span className="mt-2 size-2 rounded-full bg-blue-500 shrink-0" />
      )}
      {notification.isRead && <span className="mt-2 size-2 shrink-0" />}
      <Avatar className="size-6 shrink-0 mt-0.5">
        {actor.imageUrl && <AvatarImage src={actor.imageUrl} />}
        <AvatarFallback className="text-[10px]">
          {getInitials(actor.name ?? actor.username)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug break-words">
          <span className="font-medium">{actor.name ?? actor.username}</span>{' '}
          {notification.summary}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {notification.entityTitle} &middot; {relTime}
        </p>
      </div>
    </button>
  );
}
