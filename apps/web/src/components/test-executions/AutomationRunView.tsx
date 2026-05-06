import { useEffect, useRef } from 'react';
import { useAutomationRun } from '@/hooks/useAutomationRun';
import { BrowserPreview } from '@/components/test-cases/BrowserPreview';
import { StepReport } from '@/components/test-cases/StepReport';
import { AutomationToolbar } from '@/components/test-cases/AutomationToolbar';
import type { TestResultStatus } from '@/lib/types';

interface AutomationRunViewProps {
  testCaseId: string;
  onResultChange?: (result: TestResultStatus) => void;
}

/** Maps automation terminal status → execution case result */
function mapAutoStatus(status: string): TestResultStatus | null {
  switch (status) {
    case 'PASSED': return 'PASS';
    case 'FAILED': return 'FAIL';
    case 'TIMEOUT': return 'FAIL';
    default: return null;
  }
}

export function AutomationRunView({ testCaseId, onResultChange }: AutomationRunViewProps) {
  const run = useAutomationRun(testCaseId);
  const prevStatusRef = useRef(run.status);

  // Auto-fill result when automation completes
  useEffect(() => {
    if (run.status === prevStatusRef.current) return;
    prevStatusRef.current = run.status;

    const mapped = mapAutoStatus(run.status);
    if (mapped && onResultChange) {
      onResultChange(mapped);
    }
  }, [run.status, onResultChange]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0">
        {!run.isRunning && run.steps.length > 0 ? (
          <StepReport steps={run.steps} />
        ) : (
          <BrowserPreview frame={run.frame} isRunning={run.isRunning} />
        )}
      </div>

      <AutomationToolbar
        status={run.status}
        elapsed={run.elapsed}
        isRunning={run.isRunning}
        onRun={() => run.triggerRun.mutate()}
        onStop={() => run.cancelRun.mutate()}
        isRunPending={run.triggerRun.isPending}
      />
    </div>
  );
}
