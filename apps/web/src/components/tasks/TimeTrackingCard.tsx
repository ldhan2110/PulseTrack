import { formatMinutes, getTotalEstimated, getTotalLogged } from '../../lib/time-utils';
import type { Task } from '../../lib/types';

interface TimeTrackingCardProps {
  task: Task;
  onEstimateChange?: (minutes: number | null) => void;
  isParent: boolean;
}

export function TimeTrackingCard({ task, onEstimateChange, isParent }: TimeTrackingCardProps) {
  const totalEstimated = getTotalEstimated(task);
  const totalLogged = getTotalLogged(task);
  const isOverBudget = totalEstimated > 0 && totalLogged > totalEstimated;
  const remaining = totalEstimated - totalLogged;
  const progressPercent = totalEstimated > 0 ? Math.min((totalLogged / totalEstimated) * 100, 100) : 0;

  const estimateHours = task.estimatedMinutes ? Math.floor(task.estimatedMinutes / 60) : '';
  const estimateMinutesRemainder = task.estimatedMinutes ? task.estimatedMinutes % 60 : '';

  const handleEstimateBlur = (hoursStr: string, minsStr: string) => {
    const h = parseInt(hoursStr) || 0;
    const m = parseInt(minsStr) || 0;
    const total = h * 60 + m;
    onEstimateChange?.(total > 0 ? total : null);
  };

  return (
    <div className="border border-border rounded-lg p-3 space-y-3">
      <h4 className="text-sm font-semibold">Time Tracking</h4>

      {/* Estimate bar */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-blue-500">Estimate</span>
          <span className="text-muted-foreground">{formatMinutes(totalEstimated)}</span>
        </div>
        <div className="h-2 bg-muted rounded-full">
          <div className="h-2 bg-blue-500 rounded-full" style={{ width: '100%' }} />
        </div>
      </div>

      {/* Actual bar */}
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

      {/* Remaining / Over */}
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

      {/* Estimate input — only for leaf tasks */}
      {!isParent && onEstimateChange && (
        <div className="border-t border-border pt-2">
          <label className="text-xs text-muted-foreground mb-1 block">Set Estimate</label>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="number"
                min={0}
                placeholder="h"
                defaultValue={estimateHours}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                onBlur={(e) => {
                  const minsInput = e.target.parentElement?.nextElementSibling?.querySelector('input');
                  handleEstimateBlur(e.target.value, minsInput?.value ?? '0');
                }}
              />
            </div>
            <div className="flex-1">
              <input
                type="number"
                min={0}
                max={59}
                placeholder="m"
                defaultValue={estimateMinutesRemainder}
                className="w-full rounded-md border border-input bg-background px-2 py-1 text-xs"
                onBlur={(e) => {
                  const hoursInput = e.target.parentElement?.previousElementSibling?.querySelector('input');
                  handleEstimateBlur(hoursInput?.value ?? '0', e.target.value);
                }}
              />
            </div>
          </div>
        </div>
      )}

      {isParent && (
        <p className="text-xs text-muted-foreground italic">Auto-summed from sub-tasks</p>
      )}
    </div>
  );
}
