import { useState, useCallback, useEffect, useRef } from 'react';
import { ArrowLeft, Keyboard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable';
import { cn } from '@/lib/utils';
import { CaseStepsView } from './CaseStepsView';
import { AutomationRunView } from './AutomationRunView';
import { EvidenceUploader } from './EvidenceUploader';
import { BugAutoFillDialog } from './BugAutoFillDialog';
import { useUpdateExecutionCaseResult } from '@/hooks/useTestExecutions';
import { useTestAutomation } from '@/hooks/useTestAutomation';
import type { TestExecutionCase, TestResultStatus, Member } from '@/lib/types';

// ─── Constants ──────────────────────────────────────────────────────────────

const RESULT_OPTIONS: { key: TestResultStatus; label: string; shortcut: string; className: string }[] = [
  { key: 'PASS', label: 'Pass', shortcut: '1', className: 'bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400' },
  { key: 'FAIL', label: 'Fail', shortcut: '2', className: 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400' },
  { key: 'BLOCKED', label: 'Blocked', shortcut: '3', className: 'bg-orange-100 text-orange-700 hover:bg-orange-200 dark:bg-orange-900/30 dark:text-orange-400' },
  { key: 'SKIP', label: 'Skip', shortcut: '4', className: 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800/50 dark:text-gray-400' },
  { key: 'NOT_RUN', label: 'Not Run', shortcut: '5', className: 'bg-muted text-muted-foreground hover:bg-muted/80' },
];

const RESULT_DOT: Record<TestResultStatus, string> = {
  NOT_RUN: 'bg-muted-foreground/40',
  IN_PROGRESS: 'bg-blue-500',
  PASS: 'bg-green-500',
  FAIL: 'bg-red-500',
  BLOCKED: 'bg-orange-500',
  SKIP: 'bg-gray-400',
};

// ─── Props ──────────────────────────────────────────────────────────────────

interface ExecutionRunnerProps {
  projectId: string;
  executionCases: TestExecutionCase[];
  executionName?: string;
  initialCaseIndex: number;
  onBack: () => void;
  members: Member[];
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ExecutionRunner({
  projectId,
  executionCases,
  executionName,
  initialCaseIndex,
  onBack,
  members,
}: ExecutionRunnerProps) {
  const cases = executionCases;
  const [currentIndex, setCurrentIndex] = useState(
    Math.min(Math.max(0, initialCaseIndex), cases.length - 1),
  );
  const [notes, setNotes] = useState<string>('');
  const [bugDialogOpen, setBugDialogOpen] = useState(false);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentCase = cases[currentIndex];
  const tc = currentCase?.testCase;
  const updateResult = useUpdateExecutionCaseResult(projectId);

  // Check if current case has automation
  const { data: automation } = useTestAutomation(tc?.id ?? '');
  const hasAutomation = !!automation?.script;

  // Sync notes from case data
  useEffect(() => {
    setNotes(currentCase?.notes ?? '');
  }, [currentIndex, currentCase?.notes]);

  // Navigate cases
  const goToCase = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(cases.length - 1, index));
      setCurrentIndex(clamped);
    },
    [cases.length],
  );

  const goNext = useCallback(() => goToCase(currentIndex + 1), [currentIndex, goToCase]);
  const goPrev = useCallback(() => goToCase(currentIndex - 1), [currentIndex, goToCase]);

  // Set result
  const setResult = useCallback(
    (result: TestResultStatus) => {
      if (!currentCase) return;
      updateResult.mutate({ executionCaseId: currentCase.id, data: { result } });
    },
    [currentCase, updateResult],
  );

  // Set result and advance
  const setResultAndAdvance = useCallback(
    (result: TestResultStatus) => {
      setResult(result);
      if (currentIndex < cases.length - 1) goNext();
    },
    [setResult, currentIndex, cases.length, goNext],
  );

  // Save notes with debounce
  const saveNotes = useCallback(
    (value: string) => {
      setNotes(value);
      if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
      notesTimerRef.current = setTimeout(() => {
        if (currentCase) {
          updateResult.mutate({
            executionCaseId: currentCase.id,
            data: { result: currentCase.result, notes: value },
          });
        }
      }, 800);
    },
    [currentCase, updateResult],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'TEXTAREA' || tag === 'INPUT') return;

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          goPrev();
          break;
        case 'ArrowDown':
          e.preventDefault();
          goNext();
          break;
        case '1':
          setResult('PASS');
          break;
        case '2':
          setResult('FAIL');
          break;
        case '3':
          setResult('BLOCKED');
          break;
        case '4':
          setResult('SKIP');
          break;
        case '5':
          setResult('NOT_RUN');
          break;
        case 'Enter':
          if (currentCase) setResultAndAdvance(currentCase.result === 'NOT_RUN' ? 'PASS' : currentCase.result);
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goPrev, goNext, setResult, setResultAndAdvance, currentCase]);

  if (!currentCase || !tc) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        No test cases in this execution
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-background shrink-0">
        <Button variant="ghost" size="sm" className="size-8 p-0" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>

        <div className="flex items-center gap-2 flex-1 min-w-0">
          {executionName && (
            <span className="text-sm font-medium truncate max-w-[200px]">{executionName}</span>
          )}
          <span className="text-xs text-muted-foreground">
            Case {currentIndex + 1} of {cases.length}
          </span>
        </div>

        {/* Result buttons */}
        <div className="flex items-center gap-1">
          {RESULT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setResult(opt.key)}
              className={cn(
                'px-2 py-1 rounded text-xs font-medium transition-colors',
                currentCase.result === opt.key
                  ? opt.className + ' ring-1 ring-offset-1 ring-current'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted',
              )}
              title={`${opt.label} (${opt.shortcut})`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Keyboard hint */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm" className="size-7 p-0 text-muted-foreground">
              <Keyboard className="size-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            <div className="flex flex-col gap-0.5">
              <span>↑↓ Navigate cases</span>
              <span>1-5 Set result</span>
              <span>Enter Set + advance</span>
            </div>
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div className="w-[220px] border-r overflow-y-auto shrink-0 bg-muted/20">
          {cases.map((c, i) => (
            <button
              key={c.id}
              onClick={() => goToCase(i)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors border-b',
                i === currentIndex && 'bg-muted border-l-2 border-l-primary',
              )}
            >
              <span className={cn('size-2 rounded-full shrink-0', RESULT_DOT[c.result])} />
              <div className="flex-1 min-w-0">
                {c.testCase.testCaseKey && (
                  <span className="text-[10px] font-mono text-muted-foreground block">
                    {c.testCase.testCaseKey}
                  </span>
                )}
                <span className="text-xs truncate block">{c.testCase.title}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 min-w-0">
          {!hasAutomation ? (
            <div className="h-full overflow-y-auto">
              <CaseStepsView
                title={tc.title}
                testCaseKey={tc.testCaseKey}
                preconditions={tc.preconditions}
                expectedResult={tc.expectedResult}
                steps={tc.steps ?? []}
              />

              <div className="px-4 pb-4 flex flex-col gap-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Notes
                  </label>
                  <Textarea
                    value={notes}
                    onChange={(e) => saveNotes(e.target.value)}
                    placeholder="Add execution notes..."
                    rows={3}
                    className="mt-1 text-sm"
                  />
                </div>

                <EvidenceUploader
                  projectId={projectId}
                  executionCaseId={currentCase.id}
                  attachments={currentCase.attachments ?? []}
                />

                {currentCase.result === 'FAIL' && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-fit gap-1.5 text-destructive border-destructive/30"
                      onClick={() => setBugDialogOpen(true)}
                    >
                      Create Bug from Failure
                    </Button>
                    <BugAutoFillDialog
                      open={bugDialogOpen}
                      onOpenChange={setBugDialogOpen}
                      projectId={projectId}
                      executionCase={currentCase}
                      executionName={executionName ?? 'Test Execution'}
                      members={members}
                    />
                  </>
                )}
              </div>
            </div>
          ) : (
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel defaultSize={40} minSize={25} className="overflow-y-auto">
                <CaseStepsView
                  title={tc.title}
                  testCaseKey={tc.testCaseKey}
                  preconditions={tc.preconditions}
                  expectedResult={tc.expectedResult}
                  steps={tc.steps ?? []}
                  compact
                />
              </ResizablePanel>

              <ResizableHandle withHandle />

              <ResizablePanel defaultSize={60} minSize={30}>
                <AutomationRunView
                  key={currentCase.id}
                  testCaseId={tc.id}
                  projectId={projectId}
                  attachments={currentCase.attachments ?? []}
                />
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </div>
      </div>
    </div>
  );
}
