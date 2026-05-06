import { useState } from 'react';
import { CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepEntry {
  name: string;
  type: 'navigation' | 'action' | 'assertion' | 'custom';
  status: 'passed' | 'failed';
  duration: number;
  screenshot: string;
  error?: string;
}

interface StepReportProps {
  steps: StepEntry[];
}

export function StepReport({ steps }: StepReportProps) {
  const [selectedIndex, setSelectedIndex] = useState<number>(steps.length > 0 ? steps.length - 1 : 0);

  const selectedStep = steps[selectedIndex];
  const passedCount = steps.filter((s) => s.status === 'passed').length;
  const failedCount = steps.filter((s) => s.status === 'failed').length;

  if (steps.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No steps captured
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary bar */}
      <div className="flex items-center gap-3 px-3 py-1.5 bg-muted/50 border-b text-[10px]">
        <span className="text-muted-foreground">{steps.length} steps</span>
        {passedCount > 0 && (
          <span className="text-green-500">{passedCount} passed</span>
        )}
        {failedCount > 0 && (
          <span className="text-red-500">{failedCount} failed</span>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Step list */}
        <div className="w-[200px] border-r overflow-y-auto">
          {steps.map((step, i) => (
            <button
              key={i}
              onClick={() => setSelectedIndex(i)}
              className={cn(
                'w-full flex items-center gap-1.5 px-2 py-1.5 text-left text-[10px] hover:bg-muted/50 transition-colors',
                selectedIndex === i && 'bg-muted',
              )}
            >
              {step.status === 'passed' ? (
                <CheckCircle2 className="size-3 text-green-500 shrink-0" />
              ) : (
                <XCircle className="size-3 text-red-500 shrink-0" />
              )}
              <span className="truncate flex-1">{step.name}</span>
              <span className="text-muted-foreground shrink-0">
                {(step.duration / 1000).toFixed(1)}s
              </span>
              {selectedIndex === i && (
                <ChevronRight className="size-3 text-muted-foreground shrink-0" />
              )}
            </button>
          ))}
        </div>

        {/* Screenshot viewer */}
        <div className="flex-1 flex flex-col min-h-0">
          {selectedStep?.screenshot ? (
            <div className="flex-1 overflow-auto bg-white p-1">
              <img
                src={`data:image/jpeg;base64,${selectedStep.screenshot}`}
                alt={`Step: ${selectedStep.name}`}
                className="w-full h-auto"
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground text-xs">
              No screenshot
            </div>
          )}

          {/* Error display */}
          {selectedStep?.error && (
            <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border-t text-[10px] text-red-600 dark:text-red-400 font-mono">
              {selectedStep.error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
