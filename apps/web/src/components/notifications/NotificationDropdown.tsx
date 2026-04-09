import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotifications';
import { NotificationItem } from './NotificationItem';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { getNotificationUrl } from '@/lib/notifications';
import type { Notification } from '@/lib/types';

interface NotificationDropdownProps {
  onClose: () => void;
}

export function NotificationDropdown({ onClose }: NotificationDropdownProps) {
  const { data } = useNotifications({ limit: 10 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const navigate = useNavigate();

  const notifications = data?.items ?? [];

  const handleClick = (notification: Notification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    const url = getNotificationUrl(notification);
    if (url) navigate(url);
    onClose();
  };

  return (
    <div className="w-[min(320px,calc(100vw-2rem))] max-h-96 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-semibold">Notifications</span>
        <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => markAllRead.mutate()}>
          Mark all read
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
        ) : (
          notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} onClick={handleClick} />
          ))
        )}
      </div>
      <div className="border-t px-3 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs"
          onClick={() => { navigate('/notifications'); onClose(); }}
        >
          View all notifications
        </Button>
      </div>
    </div>
  );
}
