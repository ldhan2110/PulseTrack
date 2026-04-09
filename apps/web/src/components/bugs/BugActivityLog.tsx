import { useMemo } from 'react';
import { format, isToday, isYesterday } from 'date-fns';
import { useBugHistory } from '@/hooks/useBugHistory';
import { BugActivityEntry } from './BugActivityEntry';
import type { Member, BugHistoryEntry } from '@/lib/types';

function formatDateGroup(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
}

interface BugActivityLogProps {
  projectId: string;
  bugId: string;
  members?: Member[];
}

export function BugActivityLog({ projectId, bugId, members }: BugActivityLogProps) {
  const { data: history, isError, isLoading } = useBugHistory(projectId, bugId);

  const grouped = useMemo(() => {
    if (!history) return [];
    const groups: { label: string; entries: BugHistoryEntry[] }[] = [];
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
              <BugActivityEntry
                key={entry.id}
                entry={entry}
                members={members}
                isLast={i === group.entries.length - 1}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
