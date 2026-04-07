import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { WorkflowStatus } from '@/lib/types';

interface StatusBadgeProps {
  status: WorkflowStatus | null | undefined;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  if (!status) {
    return (
      <Badge
        variant="outline"
        className={cn(
          'font-medium text-[13px] border-dashed border-destructive text-destructive',
          className,
        )}
      >
        No Status
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium text-[13px] border-transparent',
        className,
      )}
      style={{
        backgroundColor: `color-mix(in oklch, ${status.color} 15%, transparent)`,
        color: status.color,
      }}
    >
      {status.name}
    </Badge>
  );
}
