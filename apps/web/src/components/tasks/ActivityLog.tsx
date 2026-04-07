import { useMemo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { useTaskHistory } from '@/hooks/useTaskHistory';
import { ActivityEntry } from './ActivityEntry';
import type { Member, Sprint, TaskHistoryEntry } from '@/lib/types';

function formatDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
}

interface ActivityLogProps {
  projectId: string;
  taskId: string;
  members?: Member[];
  sprints?: Sprint[];
}

export function ActivityLog({ projectId, taskId, members, sprints }: ActivityLogProps) {
  const { data: history, isError, isLoading } = useTaskHistory(projectId, taskId);

  const grouped = useMemo(() => {
    if (!history) return [];
    const groups: { label: string; entries: TaskHistoryEntry[] }[] = [];
    let currentLabel = '';
    for (const entry of history) {
      const label = formatDateGroup(entry.createdAt);
      if (label !== currentLabel) {
        currentLabel = label;
        groups.push({ label, entries: [] });
      }
      groups[groups.length - 1].entries.push(entry);
    }
    return groups;
  }, [history]);

  if (isError) {
    return (
      <p className="text-sm text-muted-foreground">
        Could not load activity. Refresh to try again.
      </p>
    );
  }

  if (isLoading) return null;

  if (grouped.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <div className="space-y-4">
      {grouped.map((group) => (
        <div key={group.label}>
          <div className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wider">
            {group.label}
          </div>
          <div>
            {group.entries.map((entry, i) => (
              <ActivityEntry
                key={entry.id}
                entry={entry}
                members={members}
                sprints={sprints}
                isLast={i === group.entries.length - 1}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
