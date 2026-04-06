import { formatDistanceToNow } from 'date-fns';
import {
  ArrowRight, UserCheck, Milestone, Star, Pencil,
  MessageSquare, MessageSquareDiff, MessageSquareX,
  FileText, ListChecks, Paperclip,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TaskHistoryEntry, Member, Sprint } from '@/lib/types';

const STATUS_LABELS: Record<string, string> = {
  BACKLOG: 'Backlog',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  BLOCKED: 'Blocked',
};

interface FieldConfig {
  icon: React.ElementType;
  color: string;
  bg: string;
}

const FIELD_CONFIG: Record<string, FieldConfig> = {
  status: { icon: ArrowRight, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/40' },
  assigneeId: { icon: UserCheck, color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-900/40' },
  sprintId: { icon: Milestone, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/40' },
  storyPoints: { icon: Star, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/40' },
  title: { icon: Pencil, color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-800' },
  comment_added: { icon: MessageSquare, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/40' },
  comment_edited: { icon: MessageSquareDiff, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/40' },
  comment_deleted: { icon: MessageSquareX, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/40' },
  description: { icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/40' },
  acceptanceCriteria: { icon: ListChecks, color: 'text-teal-600', bg: 'bg-teal-100 dark:bg-teal-900/40' },
  attachment_added: { icon: Paperclip, color: 'text-sky-600', bg: 'bg-sky-100 dark:bg-sky-900/40' },
  attachment_deleted: { icon: Paperclip, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/40' },
};

const DEFAULT_CONFIG: FieldConfig = {
  icon: ArrowRight,
  color: 'text-gray-600',
  bg: 'bg-gray-100 dark:bg-gray-800',
};

function buildDescription(
  entry: TaskHistoryEntry,
  members?: Member[],
  sprints?: Sprint[],
): string {
  const { field, newValue, oldValue } = entry;
  switch (field) {
    case 'status':
      return `moved to ${newValue ? (STATUS_LABELS[newValue] ?? newValue) : 'unknown'}`;
    case 'assigneeId': {
      if (!newValue) return 'removed assignee';
      const member = members?.find((m) => m.userId === newValue);
      return `assigned to ${member?.user.username ?? newValue}`;
    }
    case 'sprintId': {
      if (!newValue) return 'removed from sprint';
      const sprint = sprints?.find((s) => s.id === newValue);
      return `moved to sprint ${sprint?.name ?? newValue}`;
    }
    case 'storyPoints':
      return !newValue ? 'cleared story points' : `set story points to ${newValue}`;
    case 'title':
      return 'renamed task';
    case 'comment_added':
      return 'added a comment';
    case 'comment_edited':
      return 'edited a comment';
    case 'comment_deleted':
      return 'deleted a comment';
    case 'description':
      return oldValue ? 'updated the description' : 'added a description';
    case 'acceptanceCriteria':
      return 'updated acceptance criteria';
    case 'attachment_added':
      return `uploaded ${newValue}`;
    case 'attachment_deleted':
      return `removed ${oldValue}`;
    default:
      return `changed ${field}`;
  }
}

function DiffCard({ oldValue, newValue }: { oldValue?: string | null; newValue?: string | null }) {
  if (!oldValue && !newValue) return null;
  return (
    <div className="mt-1.5 text-xs rounded-md border overflow-hidden">
      {oldValue && (
        <div className="px-2.5 py-1.5 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 line-through break-words">
          {oldValue.length > 200 ? oldValue.slice(0, 200) + '...' : oldValue}
        </div>
      )}
      {newValue && (
        <div className="px-2.5 py-1.5 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 break-words">
          {newValue.length > 200 ? newValue.slice(0, 200) + '...' : newValue}
        </div>
      )}
    </div>
  );
}

const DIFF_FIELDS = ['title', 'description', 'comment_edited', 'comment_added', 'comment_deleted'];

interface ActivityEntryProps {
  entry: TaskHistoryEntry;
  members?: Member[];
  sprints?: Sprint[];
  isLast?: boolean;
}

export function ActivityEntry({ entry, members, sprints, isLast = false }: ActivityEntryProps) {
  const config = FIELD_CONFIG[entry.field] ?? DEFAULT_CONFIG;
  const Icon = config.icon;
  const description = buildDescription(entry, members, sprints);
  const showDiff = DIFF_FIELDS.includes(entry.field);

  const relativeTime = (() => {
    try {
      return formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true });
    } catch {
      return entry.createdAt;
    }
  })();

  return (
    <div className="flex gap-3 relative">
      {!isLast && (
        <div className="absolute left-[13px] top-7 bottom-0 w-px bg-border" />
      )}

      <div className={cn('relative z-10 flex items-center justify-center size-7 rounded-full shrink-0', config.bg)}>
        <Icon className={cn('size-3.5', config.color)} />
      </div>

      <div className="flex-1 min-w-0 pb-5">
        <div className="flex items-baseline gap-1 flex-wrap">
          <span className="text-sm font-medium">{entry.actor.username}</span>
          <span className="text-sm text-muted-foreground">{description}</span>
          <span className="text-xs text-muted-foreground ml-auto shrink-0">{relativeTime}</span>
        </div>
        {showDiff && <DiffCard oldValue={entry.oldValue} newValue={entry.newValue} />}
      </div>
    </div>
  );
}
