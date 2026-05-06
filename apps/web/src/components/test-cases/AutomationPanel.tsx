import { useState, useRef, useCallback } from 'react';
import { useTestAutomation, useUpsertAutomation } from '@/hooks/useTestAutomation';
import { useAutomationRun } from '@/hooks/useAutomationRun';
import { AutomationEditor } from './AutomationEditor';
import { BrowserPreview } from './BrowserPreview';
import { AutomationToolbar } from './AutomationToolbar';
import { Skeleton } from '@/components/ui/skeleton';

const DEFAULT_SCRIPT = `// Available context: page, expect, baseUrl, env
// Example:
// await page.goto(baseUrl + '/login');
// await page.fill('#email', env.TEST_EMAIL);
// await page.click('button[type="submit"]');
// await expect(page).toHaveURL('/dashboard');
`;

interface AutomationPanelProps {
  testCaseId: string;
}

export function AutomationPanel({ testCaseId }: AutomationPanelProps) {
  const { data: automation, isLoading } = useTestAutomation(testCaseId);
  const upsert = useUpsertAutomation(testCaseId);
  const run = useAutomationRun(testCaseId);

  const [localScript, setLocalScript] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const script = localScript ?? automation?.script ?? DEFAULT_SCRIPT;

  const handleScriptChange = useCallback(
    (value: string) => {
      setLocalScript(value);

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        upsert.mutate({ script: value });
      }, 1000);
    },
    [upsert],
  );

  const handleRun = useCallback(() => {
    if (localScript) {
      upsert.mutate({ script: localScript }, {
        onSuccess: () => run.triggerRun.mutate(),
      });
    } else {
      run.triggerRun.mutate();
    }
  }, [localScript, upsert, run.triggerRun]);

  const handleStop = useCallback(() => {
    run.cancelRun.mutate();
  }, [run.cancelRun]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex min-h-0">
        <div className="w-1/2 border-r flex flex-col min-h-0">
          <AutomationEditor
            script={script}
            onChange={handleScriptChange}
            logs={run.logs}
            isSaving={upsert.isPending}
          />
        </div>

        <div className="w-1/2 flex flex-col min-h-0">
          <BrowserPreview
            frame={run.frame}
            isRunning={run.isRunning}
          />
        </div>
      </div>

      <AutomationToolbar
        status={run.status}
        elapsed={run.elapsed}
        isRunning={run.isRunning}
        onRun={handleRun}
        onStop={handleStop}
        isRunPending={run.triggerRun.isPending}
      />
    </div>
  );
}
