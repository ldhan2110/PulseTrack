import { formatMinutes } from '@/lib/time-utils';
import type { Bug } from '@/lib/types';

interface BugTimeTrackingCardProps {
  bug: Bug;
}

export function BugTimeTrackingCard({ bug }: BugTimeTrackingCardProps) {
  const bugTasks = bug.bugTasks ?? [];

  let totalEstimated = 0;
  let totalLogged = 0;

  for (const bt of bugTasks) {
    const task = bt.task;
    const children = task.children ?? [];

    if (children.length > 0) {
      for (const child of children) {
        totalEstimated += child.estimatedMinutes ?? 0;
        totalLogged += (child.timeLogs ?? []).reduce((s, tl) => s + tl.minutes, 0);
      }
    } else {
      totalEstimated += task.estimatedMinutes ?? 0;
      totalLogged += (task.timeLogs ?? []).reduce((s, tl) => s + tl.minutes, 0);
    }
  }

  if (totalEstimated === 0 && totalLogged === 0) return null;

  const isOverBudget = totalEstimated > 0 && totalLogged > totalEstimated;
  const remaining = totalEstimated - totalLogged;
  const progressPercent = totalEstimated > 0 ? Math.min((totalLogged / totalEstimated) * 100, 100) : 0;

  return (
    <div className="border border-border rounded-lg p-3 space-y-3">
      <h4 className="text-sm font-semibold">Time Tracking</h4>

      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-blue-500">Estimate</span>
          <span className="text-muted-foreground">{formatMinutes(totalEstimated)}</span>
        </div>
        <div className="h-2 bg-muted rounded-full">
          <div className="h-2 bg-blue-500 rounded-full" style={{ width: '100%' }} />
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className={isOverBudget ? 'text-red-500' : 'text-green-500'}>Actual</span>
          <span className={isOverBudget ? 'text-red-500 font-semibold' : 'text-muted-foreground'}>
            {formatMinutes(totalLogged)}
            {isOverBudget && ' ⚠️'}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full">
          <div
            className={`h-2 rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-green-500'}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {totalEstimated > 0 && (
        <div className="flex justify-between text-xs border-t border-border pt-2">
          <span className={isOverBudget ? 'text-red-500' : 'text-muted-foreground'}>
            {isOverBudget ? 'Over by' : 'Remaining'}
          </span>
          <span className={isOverBudget ? 'text-red-500 font-semibold' : 'text-green-500'}>
            {formatMinutes(Math.abs(remaining))}
          </span>
        </div>
      )}

      <p className="text-xs text-muted-foreground italic">Auto-summed from linked tasks</p>
    </div>
  );
}
