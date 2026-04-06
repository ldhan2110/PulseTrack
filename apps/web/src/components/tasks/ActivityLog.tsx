import { useTaskHistory } from '@/hooks/useTaskHistory';
import { ActivityEntry } from './ActivityEntry';
import type { Member, Sprint } from '@/lib/types';

interface ActivityLogProps {
  projectId: string;
  taskId: string;
  members?: Member[];
  sprints?: Sprint[];
}

export function ActivityLog({ projectId, taskId, members, sprints }: ActivityLogProps) {
  const { data: history, isError, isLoading } = useTaskHistory(projectId, taskId);

  // API returns descending; reverse for chronological ascending display (oldest first)
  const entries = history ? [...history].reverse() : [];

  return (
    <div className="flex flex-col gap-3">
      {isError ? (
        <p className="text-sm text-muted-foreground">
          Could not load activity. Refresh to try again.
        </p>
      ) : isLoading ? null : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="relative border-l border-border ml-3">
          {entries.map((entry) => (
            <ActivityEntry
              key={entry.id}
              entry={entry}
              members={members}
              sprints={sprints}
            />
          ))}
        </div>
      )}
    </div>
  );
}
