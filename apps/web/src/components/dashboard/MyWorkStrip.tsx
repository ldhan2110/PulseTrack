import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { MyWork } from '@/lib/types';

interface MyWorkStripProps {
  myWork: MyWork;
  userId: string;
  projectPrefix: string;
}

interface Cell {
  label: string;
  value: number;
  subtext: string;
  to: string;
  tone?: 'default' | 'warning' | 'danger';
}

export function MyWorkStrip({ myWork, userId, projectPrefix }: MyWorkStripProps) {
  const navigate = useNavigate();
  const backlog = `/projects/${projectPrefix}/backlog?assignee=${userId}`;
  const bugs = `/projects/${projectPrefix}/bugs`;

  const cells: Cell[] = [
    { label: 'Open', value: myWork.openTasks, subtext: 'assigned to me', to: backlog },
    { label: 'Due soon', value: myWork.dueSoon, subtext: 'next 48h', to: backlog, tone: 'warning' },
    { label: 'My bugs', value: myWork.myBugs, subtext: 'assigned to me', to: bugs },
    { label: 'Overdue', value: myWork.overdue, subtext: 'past due date', to: backlog, tone: 'danger' },
  ];

  return (
    <div className="flex flex-col gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        My Work
      </span>
      <Card className="grid grid-cols-2 divide-y divide-border p-0 sm:grid-cols-4 sm:divide-y-0 sm:divide-x">
        {cells.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={() => navigate(c.to)}
            className="flex flex-col items-start gap-1 px-4 py-4 text-left transition-colors hover:bg-muted/50"
          >
            <span className="text-[11px] font-medium uppercase tracking-[0.04em] text-muted-foreground">
              {c.label}
            </span>
            <span
              className={cn(
                'text-[28px] font-bold leading-none tracking-[-0.03em]',
                c.tone === 'danger' && c.value > 0 && 'text-[var(--status-blocked)]',
                c.tone === 'warning' && c.value > 0 && 'text-[var(--status-in-review)]',
              )}
            >
              {c.value}
            </span>
            <span className="text-xs text-muted-foreground">{c.subtext}</span>
          </button>
        ))}
      </Card>
    </div>
  );
}
