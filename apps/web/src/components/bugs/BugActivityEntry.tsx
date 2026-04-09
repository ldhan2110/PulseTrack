import { formatDistanceToNow } from 'date-fns';
import {
  ArrowRight, UserCheck, Pencil,
  MessageSquare, MessageSquareDiff, MessageSquareX,
  FileText, Paperclip, Shield, Monitor,
  Eye, EyeOff, AlertTriangle, CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BugHistoryEntry, Member } from '@/lib/types';

const SEVERITY_LABELS: Record<string, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
  BLOCKER: 'Blocker',
};

interface FieldConfig {
  icon: React.ElementType;
  color: string;
  bg: string;
}

const FIELD_CONFIG: Record<string, FieldConfig> = {
  workflowStatusId: { icon: ArrowRight, color: 'text-blue-600', bg: 'bg-blue-100 dark:bg-blue-900/40' },
  assigneeId: { icon: UserCheck, color: 'text-violet-600', bg: 'bg-violet-100 dark:bg-violet-900/40' },
  severity: { icon: Shield, color: 'text-orange-600', bg: 'bg-orange-100 dark:bg-orange-900/40' },
  title: { icon: Pencil, color: 'text-gray-600', bg: 'bg-gray-100 dark:bg-gray-800' },
  description: { icon: FileText, color: 'text-indigo-600', bg: 'bg-indigo-100 dark:bg-indigo-900/40' },
  environment: { icon: Monitor, color: 'text-cyan-600', bg: 'bg-cyan-100 dark:bg-cyan-900/40' },
  expectedResult: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/40' },
  actualResult: { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-100 dark:bg-amber-900/40' },
  comment_added: { icon: MessageSquare, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/40' },
  comment_edited: { icon: MessageSquareDiff, color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/40' },
  comment_deleted: { icon: MessageSquareX, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/40' },
  attachment_added: { icon: Paperclip, color: 'text-sky-600', bg: 'bg-sky-100 dark:bg-sky-900/40' },
  attachment_deleted: { icon: Paperclip, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/40' },
  watcher_added: { icon: Eye, color: 'text-green-600', bg: 'bg-green-100 dark:bg-green-900/40' },
  watcher_removed: { icon: EyeOff, color: 'text-red-600', bg: 'bg-red-100 dark:bg-red-900/40' },
};

const DEFAULT_CONFIG: FieldConfig = {
  icon: ArrowRight,
  color: 'text-gray-600',
  bg: 'bg-gray-100 dark:bg-gray-800',
};

function buildDescription(
  entry: BugHistoryEntry,
  members?: Member[],
): string {
  const { field, newValue, oldValue } = entry;
  switch (field) {
    case 'workflowStatusId':
      return `moved to ${newValue ?? 'unknown'}`;
    case 'assigneeId': {
      if (!newValue) return 'removed assignee';
      const member = members?.find((m) => m.userId === newValue);
      return `assigned to ${member?.user.name ?? member?.user.username ?? newValue}`;
    }
    case 'severity':
      return `changed severity to ${newValue ? (SEVERITY_LABELS[newValue] ?? newValue) : 'unknown'}`;
    case 'title':
      return 'renamed bug';
    case 'description':
      return oldValue ? 'updated the description' : 'added a description';
    case 'environment':
      return newValue ? `set environment to "${newValue}"` : 'cleared environment';
    case 'expectedResult':
      return oldValue ? 'updated expected result' : 'added expected result';
    case 'actualResult':
      return oldValue ? 'updated actual result' : 'added actual result';
    case 'comment_added':
      return 'added a comment';
    case 'comment_edited':
      return 'edited a comment';
    case 'comment_deleted':
      return 'deleted a comment';
    case 'attachment_added':
      return `uploaded ${newValue}`;
    case 'attachment_deleted':
      return `removed ${oldValue}`;
    case 'watcher_added':
      return `added ${newValue} as watcher${newValue && newValue.includes(',') ? 's' : ''}`;
    case 'watcher_removed':
      return `removed ${oldValue} from watchers`;
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

const DIFF_FIELDS = ['title', 'description', 'comment_edited', 'comment_added', 'comment_deleted', 'expectedResult', 'actualResult'];

interface BugActivityEntryProps {
  entry: BugHistoryEntry;
  members?: Member[];
  isLast?: boolean;
}

export function BugActivityEntry({ entry, members, isLast = false }: BugActivityEntryProps) {
  const config = FIELD_CONFIG[entry.field] ?? DEFAULT_CONFIG;
  const Icon = config.icon;
  const description = buildDescription(entry, members);
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
          <span className="text-sm font-medium">{entry.actor.name ?? entry.actor.username}</span>
          <span className="text-sm text-muted-foreground">{description}</span>
          <span className="text-xs text-muted-foreground ml-auto shrink-0">{relativeTime}</span>
        </div>
        {showDiff && <DiffCard oldValue={entry.oldValue} newValue={entry.newValue} />}
      </div>
    </div>
  );
}
