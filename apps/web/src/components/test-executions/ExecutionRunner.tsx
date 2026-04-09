import { useState } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle2, XCircle, AlertTriangle, SkipForward, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useUpdateExecutionCaseResult } from '@/hooks/useTestExecutions';
import { EvidenceUploader } from './EvidenceUploader';
import { BugAutoFillDialog } from './BugAutoFillDialog';
import type { TestExecutionCase, TestResultStatus, Member } from '@/lib/types';

const RESULT_COLORS: Record<TestResultStatus, string> = {
  PASS: '#22c55e',
  FAIL: '#ef4444',
  BLOCKED: '#f59e0b',
  SKIP: '#6b7280',
  NOT_RUN: '#374151',
  IN_PROGRESS: '#3b82f6',
};

const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700',
  HIGH: 'bg-orange-100 text-orange-700',
  MEDIUM: 'bg-yellow-100 text-yellow-700',
  LOW: 'bg-green-100 text-green-700',
  BLOCKER: 'bg-purple-100 text-purple-700',
};

interface ExecutionRunnerProps {
  projectId: string;
  executionCases: TestExecutionCase[];
  executionName: string;
  initialCaseIndex?: number;
  onBack: () => void;
  members: Member[];
}

export function ExecutionRunner({
  projectId,
  executionCases,
  executionName,
  initialCaseIndex = 0,
  onBack,
  members,
}: ExecutionRunnerProps) {
  const [currentCaseIndex, setCurrentCaseIndex] = useState(initialCaseIndex);
  const [noteText, setNoteText] = useState('');
  const [bugDialogOpen, setBugDialogOpen] = useState(false);

  const updateResult = useUpdateExecutionCaseResult(projectId);

  const currentCase = executionCases[currentCaseIndex];
  if (!currentCase) return null;

  const tc = currentCase.testCase;
  const total = executionCases.length;

  const handleResult = (result: TestResultStatus) => {
    updateResult.mutate(
      {
        executionCaseId: currentCase.id,
        data: { result, notes: noteText.trim() || undefined },
      },
      {
        onSuccess: () => {
          setNoteText('');
          if (result === 'FAIL') {
            setBugDialogOpen(true);
          } else if (currentCaseIndex < total - 1) {
            setCurrentCaseIndex((prev) => prev + 1);
          }
        },
      },
    );
  };

  const handleMarkAllPass = () => {
    executionCases.forEach((ec) => {
      if (ec.result === 'NOT_RUN' || ec.result === 'IN_PROGRESS') {
        updateResult.mutate({
          executionCaseId: ec.id,
          data: { result: 'PASS' },
        });
      }
    });
  };

  return (
    <div className="flex flex-col gap-4 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Back to Run
        </button>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            Case {currentCaseIndex + 1} of {total}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentCaseIndex === 0}
              onClick={() => setCurrentCaseIndex((prev) => prev - 1)}
            >
              <ChevronLeft className="size-4" />
              Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={currentCaseIndex === total - 1}
              onClick={() => setCurrentCaseIndex((prev) => prev + 1)}
            >
              Next
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Case Info */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          {tc.testCaseKey && (
            <span className="font-mono text-sm text-muted-foreground">{tc.testCaseKey}</span>
          )}
          <h2 className="text-lg font-semibold">{tc.title}</h2>
          {tc.priority && (
            <Badge variant="secondary" className={cn('text-xs', PRIORITY_COLORS[tc.priority])}>
              {tc.priority}
            </Badge>
          )}
          {currentCase.result !== 'NOT_RUN' && (
            <Badge
              variant="secondary"
              className="text-xs text-white"
              style={{ backgroundColor: RESULT_COLORS[currentCase.result] }}
            >
              {currentCase.result}
            </Badge>
          )}
        </div>
      </div>

      {/* Preconditions */}
      {tc.preconditions && (
        <div className="rounded-md bg-muted p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Preconditions</p>
          <p className="text-sm whitespace-pre-wrap">{tc.preconditions}</p>
        </div>
      )}

      {/* Expected Result */}
      {tc.expectedResult && (
        <div className="rounded-md bg-muted p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-1">Expected Result</p>
          <p className="text-sm whitespace-pre-wrap">{tc.expectedResult}</p>
        </div>
      )}

      {/* Steps */}
      {tc.steps && tc.steps.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">Steps</h3>
          <div className="flex flex-col gap-1.5">
            {tc.steps.map((step, idx) => (
              <div
                key={step.id}
                className="flex items-start gap-3 rounded-md border p-3"
              >
                <div
                  className="flex size-6 items-center justify-center rounded-full text-xs font-medium text-white shrink-0"
                  style={{ backgroundColor: RESULT_COLORS[currentCase.result] }}
                >
                  {idx + 1}
                </div>
                <div className="flex flex-col gap-1 flex-1 min-w-0">
                  <p className="text-sm">{step.action}</p>
                  {step.expectedResult && (
                    <p className="text-xs text-muted-foreground">
                      Expected: {step.expectedResult}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Note */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[13px] font-semibold leading-none">Notes (optional)</label>
        <Textarea
          placeholder="Add notes for this test case..."
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          rows={2}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          size="sm"
          className="gap-1.5"
          style={{ backgroundColor: '#22c55e' }}
          onClick={() => handleResult('PASS')}
          disabled={updateResult.isPending}
        >
          <CheckCircle2 className="size-4" />
          Pass
        </Button>
        <Button
          size="sm"
          className="gap-1.5"
          style={{ backgroundColor: '#ef4444' }}
          onClick={() => handleResult('FAIL')}
          disabled={updateResult.isPending}
        >
          <XCircle className="size-4" />
          Fail
        </Button>
        <Button
          size="sm"
          className="gap-1.5"
          style={{ backgroundColor: '#f59e0b' }}
          onClick={() => handleResult('BLOCKED')}
          disabled={updateResult.isPending}
        >
          <AlertTriangle className="size-4" />
          Blocked
        </Button>
        <Button
          size="sm"
          variant="secondary"
          className="gap-1.5"
          onClick={() => handleResult('SKIP')}
          disabled={updateResult.isPending}
        >
          <SkipForward className="size-4" />
          Skip
        </Button>
        <div className="flex-1" />
        <Button
          size="sm"
          variant="outline"
          onClick={handleMarkAllPass}
          disabled={updateResult.isPending}
        >
          Mark All Pass
        </Button>
      </div>

      {/* Create Bug button for failed cases */}
      {currentCase.result === 'FAIL' && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 w-fit"
          onClick={() => setBugDialogOpen(true)}
        >
          <Bug className="size-4" />
          Create Bug
        </Button>
      )}

      {/* Evidence */}
      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-semibold">Evidence</h3>
        <EvidenceUploader
          projectId={projectId}
          executionCaseId={currentCase.id}
          attachments={currentCase.attachments ?? []}
        />
      </div>

      {/* Bug Auto-Fill Dialog */}
      <BugAutoFillDialog
        open={bugDialogOpen}
        onOpenChange={setBugDialogOpen}
        projectId={projectId}
        executionCase={currentCase}
        executionName={executionName}
        members={members}
      />
    </div>
  );
}
