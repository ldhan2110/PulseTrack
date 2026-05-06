import type { TestExecutionStats } from '@/lib/types';

interface ExecutionStatsBarProps {
  stats: TestExecutionStats;
}

function ProgressRing({ percent }: { percent: number }) {
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative size-14 shrink-0">
      <svg className="size-full -rotate-90" viewBox="0 0 48 48">
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-muted"
        />
        <circle
          cx="24"
          cy="24"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-green-500 transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold">
        {Math.round(percent)}%
      </span>
    </div>
  );
}

const STAT_CHIPS: { key: keyof TestExecutionStats; label: string; className: string }[] = [
  { key: 'PASS', label: 'Pass', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  { key: 'FAIL', label: 'Fail', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' },
  { key: 'BLOCKED', label: 'Blocked', className: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' },
  { key: 'SKIP', label: 'Skip', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400' },
  { key: 'NOT_RUN', label: 'Not Run', className: 'bg-muted text-muted-foreground' },
];

export function ExecutionStatsBar({ stats }: ExecutionStatsBarProps) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border bg-card">
      <ProgressRing percent={stats.completionPercent} />

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium mr-1">
          {stats.completed}/{stats.total} cases
        </span>
        {STAT_CHIPS.map(({ key, label, className }) => {
          const count = stats[key] as number;
          if (count === 0) return null;
          return (
            <span
              key={key}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}
            >
              {count} {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
