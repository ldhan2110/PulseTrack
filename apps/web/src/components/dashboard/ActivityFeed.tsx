import { formatDistanceToNow } from 'date-fns';
import { History } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
    <Card className="h-[460px]">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="min-h-0 flex-1">
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
          <div className="flex h-full flex-col overflow-y-auto">
            {activity.map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
              >
                <Avatar className="size-8">
                  {item.actorImageUrl && (
                    <AvatarImage src={item.actorImageUrl} alt={item.actor} />
                  )}
                  <AvatarFallback className="text-[11px] font-medium">
                    {initials(item.actor)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 text-sm leading-snug">
                  <span className="font-medium">{item.actor}</span>{' '}
                  <span className="text-muted-foreground">{item.verb}</span>{' '}
                  <span className="font-medium text-primary">{item.targetKey}</span>
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
