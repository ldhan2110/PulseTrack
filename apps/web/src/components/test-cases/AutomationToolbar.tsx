import { Button } from '@/components/ui/button';
import { Play, Square, Loader2, Sparkles } from 'lucide-react';
import type { AutomationRunStatus } from '@/lib/types';

interface AutomationToolbarProps {
  status: AutomationRunStatus | 'idle';
  elapsed: number;
  isRunning: boolean;
  onRun: () => void;
  onStop: () => void;
  isRunPending: boolean;
  onGenerate: () => void;
  isGeneratePending: boolean;
}

function formatElapsed(ms: number): string {
  return (ms / 1000).toFixed(1) + 's';
}

const STATUS_LABELS: Record<string, { text: string; className: string }> = {
  idle: { text: 'Ready', className: 'text-muted-foreground' },
  RUNNING: { text: 'Running...', className: 'text-yellow-500' },
  PASSED: { text: 'Passed', className: 'text-green-500' },
  FAILED: { text: 'Failed', className: 'text-red-500' },
  CANCELLED: { text: 'Cancelled', className: 'text-muted-foreground' },
  TIMEOUT: { text: 'Timed out', className: 'text-red-500' },
};

export function AutomationToolbar({
  status,
  elapsed,
  isRunning,
  onRun,
  onStop,
  isRunPending,
  onGenerate,
  isGeneratePending,
}: AutomationToolbarProps) {
  const statusInfo = STATUS_LABELS[status] ?? STATUS_LABELS.idle;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-t">
      <div className="flex items-center gap-2 text-xs">
        {isRunning && (
          <Loader2 className="size-3 animate-spin text-yellow-500" />
        )}
        <span className={statusInfo.className}>{statusInfo.text}</span>
        {(isRunning || elapsed > 0) && (
          <span className="text-muted-foreground">{formatElapsed(elapsed)}</span>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="h-7 gap-1"
          onClick={onGenerate}
          disabled={isGeneratePending || isRunning}
        >
          {isGeneratePending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <Sparkles className="size-3" />
          )}
          Generate Script
        </Button>
        {isRunning ? (
          <Button variant="secondary" size="sm" className="h-7 gap-1" onClick={onStop}>
            <Square className="size-3" />
            Stop
          </Button>
        ) : (
          <Button
            size="sm"
            className="h-7 gap-1"
            onClick={onRun}
            disabled={isRunPending}
          >
            {isRunPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Play className="size-3" />
            )}
            Run
          </Button>
        )}
      </div>
    </div>
  );
}
