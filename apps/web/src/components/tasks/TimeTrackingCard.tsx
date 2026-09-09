// apps/web/src/components/tasks/TimeTrackingCard.tsx
import { useState } from 'react';
import { Pencil, Clock } from 'lucide-react';
import { Button } from '../ui/button';
import { formatMinutes, getTotalEstimated, getTotalLogged } from '../../lib/time-utils';
import type { Task } from '../../lib/types';
import { SetEstimateModal } from './SetEstimateModal';
import { LogTimeModal } from './LogTimeModal';

interface TimeTrackingCardProps {
  task: Task;
  onEstimateChange?: (minutes: number | null) => void;
  onLogTime?: (data: { minutes: number; comment?: string; loggedAt?: string; progress?: number }) => void;
  isParent: boolean;
  isLogTimeLoading?: boolean;
}

export function TimeTrackingCard({
  task,
  onEstimateChange,
  onLogTime,
  isParent,
  isLogTimeLoading,
}: TimeTrackingCardProps) {
  const [estimateModalOpen, setEstimateModalOpen] = useState(false);
  const [logTimeModalOpen, setLogTimeModalOpen] = useState(false);

  const totalEstimated = getTotalEstimated(task);
  const totalLogged = getTotalLogged(task);
  const isOverBudget = totalEstimated > 0 && totalLogged > totalEstimated;
  const remaining = totalEstimated - totalLogged;
  const progressPercent = totalEstimated > 0 ? Math.min((totalLogged / totalEstimated) * 100, 100) : 0;

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

      {/* Action buttons — only for leaf tasks */}
      {!isParent && (
        <div className="flex flex-col gap-1.5 border-t border-border pt-2">
          {onEstimateChange && (
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5 h-7 text-xs"
              onClick={() => setEstimateModalOpen(true)}
            >
              <Pencil className="size-3" />
              Set Estimate
            </Button>
          )}
          {onLogTime && (
            <Button
              size="sm"
              className="w-full gap-1.5 h-7 text-xs"
              onClick={() => setLogTimeModalOpen(true)}
            >
              <Clock className="size-3" />
              Log Time
            </Button>
          )}
        </div>
      )}

      {isParent && (
        <p className="text-xs text-muted-foreground italic">Auto-summed from sub-tasks</p>
      )}

      {/* Modals */}
      {onEstimateChange && (
        <SetEstimateModal
          open={estimateModalOpen}
          onOpenChange={setEstimateModalOpen}
          currentEstimateMinutes={task.estimatedMinutes ?? null}
          onSave={onEstimateChange}
        />
      )}
      {onLogTime && (
        <LogTimeModal
          open={logTimeModalOpen}
          onOpenChange={setLogTimeModalOpen}
          onSubmit={onLogTime}
          isLoading={isLogTimeLoading}
          currentProgress={task.progress ?? 0}
        />
      )}
    </div>
  );
}
