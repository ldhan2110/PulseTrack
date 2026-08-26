import { useState, useRef, useCallback } from 'react';
import { useTestAutomation, useUpsertAutomation, useGenerateScript } from '@/hooks/useTestAutomation';
import { useAutomationRun } from '@/hooks/useAutomationRun';
import { AutomationEditor } from './AutomationEditor';
import { BrowserPreview } from './BrowserPreview';
import { StepReport } from './StepReport';
import { AutomationToolbar } from './AutomationToolbar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';

const DEFAULT_SCRIPT = `// Available context: page, expect, env
// Example:
// await page.goto('https://example.com/login');
// await page.fill('#email', env.TEST_EMAIL);
// await page.click('button[type="submit"]');
// await expect(page).toHaveURL('/dashboard');
`;

interface AutomationPanelProps {
  testCaseId: string;
  projectId: string;
}

export function AutomationPanel({ testCaseId, projectId }: AutomationPanelProps) {
  const { data: automation, isLoading } = useTestAutomation(testCaseId);
  const upsert = useUpsertAutomation(testCaseId);
  const run = useAutomationRun(testCaseId);
  const generate = useGenerateScript(testCaseId, projectId);

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

  const handleGenerate = useCallback(() => {
    // Worker auto-saves the script to the DB on completion; drop any local edit
    // so the freshly-saved script loads via the refetched automation query.
    setLocalScript(null);
    generate.generate.mutate();
  }, [generate]);

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
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={50} minSize={25} className="flex flex-col min-h-0">
          <AutomationEditor
            script={script}
            onChange={handleScriptChange}
            logs={run.logs}
            isSaving={upsert.isPending}
          />
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={50} minSize={25} className="flex flex-col min-h-0">
          {!run.isRunning && run.steps.length > 0 ? (
            <StepReport steps={run.steps} />
          ) : (
            <BrowserPreview
              frame={run.frame}
              isRunning={run.isRunning}
            />
          )}
        </ResizablePanel>
      </ResizablePanelGroup>

      <AutomationToolbar
        status={run.status}
        elapsed={run.elapsed}
        isRunning={run.isRunning}
        onRun={handleRun}
        onStop={handleStop}
        isRunPending={run.triggerRun.isPending}
        onGenerate={handleGenerate}
        isGeneratePending={generate.isActive}
        generateStep={generate.step}
      />
    </div>
  );
}
