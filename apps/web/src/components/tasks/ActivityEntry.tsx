import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { TaskHistoryEntry, Member, Sprint } from '@/lib/types';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  BLOCKED: 'Blocked',
};

function buildChangeDescription(
  entry: TaskHistoryEntry,
  members?: Member[],
  sprints?: Sprint[],
): string {
  const { field, newValue } = entry;

  switch (field) {
    case 'status': {
      const label = newValue ? (STATUS_LABELS[newValue] ?? newValue) : newValue;
      return `moved to ${label}`;
    }
    case 'assigneeId': {
      if (!newValue) return 'removed assignee';
      const member = members?.find((m) => m.userId === newValue);
      const name = member?.user.username ?? newValue;
      return `assigned to ${name}`;
    }
    case 'sprintId': {
      if (!newValue) return 'removed from sprint';
      const sprint = sprints?.find((s) => s.id === newValue);
      const name = sprint?.name ?? newValue;
      return `moved to sprint ${name}`;
    }
    case 'storyPoints': {
      if (!newValue) return 'cleared story points';
      return `set story points to ${newValue}`;
    }
    case 'title': {
      return `renamed to "${newValue}"`;
    }
    default:
      return `changed ${field}`;
  }
}

interface ActivityEntryProps {
  entry: TaskHistoryEntry;
  members?: Member[];
  sprints?: Sprint[];
}

export function ActivityEntry({ entry, members, sprints }: ActivityEntryProps) {
  const description = buildChangeDescription(entry, members, sprints);

  const relativeTime = (() => {
    try {
      return formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true });
    } catch {
      return entry.createdAt;
    }
  })();

  return (
    <div className="flex gap-2 pl-1">
      <Avatar className="size-6 shrink-0 mt-0.5">
        <AvatarFallback className="text-[10px]">
          {getInitials(entry.actor.username)}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0 pb-3">
        <span className="text-xs font-medium">{entry.actor.username}</span>
        <span className="text-xs text-muted-foreground"> {description}</span>
        <div className="text-xs text-muted-foreground mt-0.5">{relativeTime}</div>
      </div>
    </div>
  );
}
