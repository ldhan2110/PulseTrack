import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { TaskStatus } from '@/lib/types';

const STATUS_LABELS: Record<TaskStatus, string> = {
  BACKLOG: 'Backlog',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  BLOCKED: 'Blocked',
};

interface StatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium text-[13px] border-transparent',
        {
          'text-[var(--status-backlog)] border border-[var(--status-backlog)]':
            status === 'BACKLOG',
          'bg-[color-mix(in_oklch,var(--status-in-progress)_15%,transparent)] text-[var(--status-in-progress)] border-0':
            status === 'IN_PROGRESS',
          'bg-[color-mix(in_oklch,var(--status-in-review)_15%,transparent)] text-[var(--status-in-review)] border-0':
            status === 'IN_REVIEW',
          'bg-[color-mix(in_oklch,var(--status-done)_15%,transparent)] text-[var(--status-done)] border-0':
            status === 'DONE',
          'bg-[color-mix(in_oklch,var(--status-blocked)_15%,transparent)] text-[var(--status-blocked)] border-0':
            status === 'BLOCKED',
        },
        className,
      )}
    >
      {STATUS_LABELS[status]}
    </Badge>
  );
}
