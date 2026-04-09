import { useState } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { useNotifications, useMarkNotificationRead, useMarkAllNotificationsRead } from '@/hooks/useNotifications';
import { getNotificationUrl } from '@/lib/notifications';
import { useNavigate } from 'react-router-dom';
import type { Notification } from '@/lib/types';

const TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'STATUS_CHANGE', label: 'Status changes' },
  { value: 'ASSIGNEE_CHANGE', label: 'Assignee changes' },
  { value: 'COMMENT_ADDED', label: 'Comments' },
  { value: 'MENTION', label: 'Mentions' },
  { value: 'ATTACHMENT_CHANGE', label: 'Attachments' },
  { value: 'CRITERIA_CHANGE', label: 'Criteria' },
  { value: 'SUBTASK_CHANGE', label: 'Sub-tasks' },
  { value: 'PRIORITY_CHANGE', label: 'Priority' },
];

export function NotificationsPage() {
  const [page, setPage] = useState(1);
  const [isReadFilter, setIsReadFilter] = useState<boolean | undefined>(undefined);
  const [typeFilter, setTypeFilter] = useState('all');
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();
  const navigate = useNavigate();

  const { data, isLoading } = useNotifications({
    page,
    isRead: isReadFilter,
    type: typeFilter === 'all' ? undefined : typeFilter,
  });

  const notifications = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  const handleClick = (notification: Notification) => {
    if (!notification.isRead) markRead.mutate(notification.id);
    const url = getNotificationUrl(notification);
    if (url) navigate(url);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Bell className="size-5" />
          <h1 className="text-xl font-semibold">Notifications</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => markAllRead.mutate()}>
          Mark all as read
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Tabs
          value={isReadFilter === undefined ? 'all' : isReadFilter ? 'read' : 'unread'}
          onValueChange={(v) => {
            setIsReadFilter(v === 'all' ? undefined : v === 'read');
            setPage(1);
          }}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">Unread</TabsTrigger>
            <TabsTrigger value="read">Read</TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-40 h-8">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border divide-y">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Loading...</p>
        ) : notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No notifications</p>
        ) : (
          notifications.map((n) => (
            <NotificationItem key={n.id} notification={n} onClick={handleClick} />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
