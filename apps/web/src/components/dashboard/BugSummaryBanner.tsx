import { Bug, ChevronRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { BugCounts } from '@/lib/types';

interface BugSummaryBannerProps {
  bugCounts: BugCounts;
}

export function BugSummaryBanner({ bugCounts }: BugSummaryBannerProps) {
  const navigate = useNavigate();
  const { projectPrefix = '' } = useParams<{ projectPrefix: string }>();

  const cells = [
    { label: 'Total', value: bugCounts.total, danger: false },
    { label: 'Open', value: bugCounts.open, danger: false },
    { label: 'Critical', value: bugCounts.critical, danger: true },
  ];

  return (
    <Card
      className="flex cursor-pointer items-stretch divide-x divide-border p-0 transition-colors hover:bg-muted/50"
      onClick={() => navigate(`/projects/${projectPrefix}/bugs`)}
    >
      <div className="flex items-center gap-2 bg-red-50 px-5 py-3 dark:bg-red-950/30">
        <Bug className="size-4 text-red-600 dark:text-red-400" />
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-red-700 dark:text-red-300">Bug Summary</span>
          <span className="text-xs text-muted-foreground">project bugs</span>
        </div>
      </div>

      {cells.map((c) => (
        <div key={c.label} className="flex flex-col items-start gap-1 px-5 py-3">
          <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
            {c.label}
          </span>
          <span
            className={cn(
              'text-[28px] font-bold leading-none tracking-[-0.03em]',
              c.danger && c.value > 0 && 'text-[var(--status-blocked)]',
            )}
          >
            {c.value}
          </span>
        </div>
      ))}

      <ChevronRight className="ml-auto size-4 self-center pr-1 text-muted-foreground" />
    </Card>
  );
}
