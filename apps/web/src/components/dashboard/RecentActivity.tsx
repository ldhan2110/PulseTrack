import { formatDistanceToNow } from 'date-fns';
import { CheckSquare, Bug } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ActivityItem {
  id: string;
  type: string;
  title: string;
  actor: string;
  timestamp: string;
}

interface RecentActivityProps {
  activities: ActivityItem[];
}

export function RecentActivity({ activities }: RecentActivityProps) {
  const displayed = activities.slice(0, 20);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {displayed.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent activity</p>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="flex flex-col gap-3">
              {displayed.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0 text-muted-foreground">
                    {activity.type === 'bug' ? (
                      <Bug className="size-4" />
                    ) : (
                      <CheckSquare className="size-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{activity.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.actor} &middot;{' '}
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
