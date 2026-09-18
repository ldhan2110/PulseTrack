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

  const resolved = Math.max(0, bugCounts.total - bugCounts.open);

  const cells = [
    { label: 'Total', value: bugCounts.total, tone: 'default' as const, dot: undefined },
    { label: 'Open', value: bugCounts.open, tone: 'warning' as const, dot: 'var(--status-in-review)' },
    { label: 'Resolved', value: resolved, tone: 'done' as const, dot: 'var(--status-done)' },
    { label: 'Critical', value: bugCounts.critical, tone: 'danger' as const, dot: 'var(--status-blocked)' },
  ];

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        Bug Summary
      </span>
      <Card
        className="group flex !flex-row cursor-pointer items-stretch divide-x divide-border p-0 transition-colors hover:bg-muted/40"
        onClick={() => navigate(`/projects/${projectPrefix}/bugs`)}
      >
        {cells.map((c) => (
          <div
            key={c.label}
            className="flex min-w-[130px] flex-1 flex-col items-start justify-center gap-1 px-6 py-4"
          >
            <span className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
              {c.label === 'Total' ? (
                <Bug className="size-3.5 text-red-500" />
              ) : (
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.dot }} />
              )}
              {c.label}
            </span>
            <span
              className={cn(
                'text-[28px] font-bold leading-none tracking-[-0.03em]',
                c.tone === 'danger' && c.value > 0 && 'text-[var(--status-blocked)]',
                c.tone === 'warning' && c.value > 0 && 'text-[var(--status-in-review)]',
                c.tone === 'done' && c.value > 0 && 'text-[var(--status-done)]',
              )}
            >
              {c.value}
            </span>
          </div>
        ))}

        <div className="flex shrink-0 items-center pr-4 pl-2">
          <ChevronRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
        </div>
      </Card>
    </div>
  );
}
