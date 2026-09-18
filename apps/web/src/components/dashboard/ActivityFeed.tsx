import { formatDistanceToNow } from 'date-fns';
import { History } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { ActivityItem } from '@/lib/types';

interface ActivityFeedProps {
  activity: ActivityItem[];
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function relative(at: string): string {
  try {
    return formatDistanceToNow(new Date(at), { addSuffix: true });
  } catch {
    return '';
  }
}

export function ActivityFeed({ activity }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
              <History className="size-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No activity yet</p>
            <p className="text-xs text-muted-foreground">
              Team actions — status changes, comments, bugs — will show up here as work begins.
            </p>
          </div>
        ) : (
          <div className="flex max-h-[280px] flex-col gap-3 overflow-y-auto">
            {activity.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-medium text-muted-foreground">
                  {initials(item.actor)}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <span className="font-medium">{item.actor}</span>{' '}
                  <span className="text-muted-foreground">{item.verb}</span>{' '}
                  <span className="font-medium">{item.targetKey}</span>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{relative(item.at)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
