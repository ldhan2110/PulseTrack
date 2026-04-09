import { useState } from 'react';
import { ArrowLeft, Play, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useUpdateExecutionCaseResult } from '@/hooks/useTestExecutions';
import { BugAutoFillDialog } from './BugAutoFillDialog';
import type { TestExecution, TestExecutionCase, TestResultStatus, Member } from '@/lib/types';

const STATUS_BADGE: Record<string, { className: string; label: string }> = {
  PENDING: { className: 'bg-yellow-100 text-yellow-700', label: 'Pending' },
  IN_PROGRESS: { className: 'bg-blue-100 text-blue-700', label: 'In Progress' },
  COMPLETED: { className: 'bg-green-100 text-green-700', label: 'Completed' },
};

const RESULT_COLORS: Record<TestResultStatus, string> = {
  PASS: '#22c55e',
  FAIL: '#ef4444',
  BLOCKED: '#f59e0b',
  SKIP: '#6b7280',
  NOT_RUN: '#374151',
  IN_PROGRESS: '#3b82f6',
};

const RESULT_LABELS: Record<TestResultStatus, string> = {
  PASS: 'Pass',
  FAIL: 'Fail',
  BLOCKED: 'Blocked',
  SKIP: 'Skip',
  NOT_RUN: 'Not Run',
  IN_PROGRESS: 'In Progress',
};

const ALL_RESULTS: TestResultStatus[] = ['NOT_RUN', 'IN_PROGRESS', 'PASS', 'FAIL', 'BLOCKED', 'SKIP'];

interface ExecutionDetailProps {
  projectId: string;
  execution: TestExecution;
  onStartRunner: (caseIndex: number) => void;
  onBack: () => void;
  members: Member[];
}

export function ExecutionDetail({
  projectId,
  execution,
  onStartRunner,
  onBack,
  members,
}: ExecutionDetailProps) {
  const [bugDialogCase, setBugDialogCase] = useState<TestExecutionCase | null>(null);
  const updateResult = useUpdateExecutionCaseResult(projectId);

  const cases = execution.cases ?? [];
  const stats = execution.stats;
  const statusInfo = STATUS_BADGE[execution.status] ?? STATUS_BADGE.PENDING;

  const firstNotRunIndex = cases.findIndex(
    (c) => c.result === 'NOT_RUN' || c.result === 'IN_PROGRESS',
  );

  const handleQuickResult = (executionCaseId: string, result: string) => {
    updateResult.mutate({ executionCaseId, data: { result } });
  };

  return (
    <div className="flex flex-col gap-4 p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back
          </button>
          <h1 className="text-xl font-semibold tracking-tight">{execution.name}</h1>
          <Badge variant="secondary" className={cn('text-xs', statusInfo.className)}>
            {statusInfo.label}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {execution.assignee && (
            <span className="text-sm text-muted-foreground">
              Assigned to {execution.assignee.name ?? execution.assignee.username}
            </span>
          )}
          {firstNotRunIndex >= 0 && (
            <Button size="sm" onClick={() => onStartRunner(firstNotRunIndex)}>
              <Play className="size-4 mr-1" />
              Resume Testing
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {stats && (
        <>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-3 rounded-full overflow-hidden bg-muted flex">
              {stats.PASS > 0 && (
                <div
                  className="h-full"
                  style={{
                    backgroundColor: RESULT_COLORS.PASS,
                    width: `${(stats.PASS / stats.total) * 100}%`,
                  }}
                />
              )}
              {stats.FAIL > 0 && (
                <div
                  className="h-full"
                  style={{
                    backgroundColor: RESULT_COLORS.FAIL,
                    width: `${(stats.FAIL / stats.total) * 100}%`,
                  }}
                />
              )}
              {stats.BLOCKED > 0 && (
                <div
                  className="h-full"
                  style={{
                    backgroundColor: RESULT_COLORS.BLOCKED,
                    width: `${(stats.BLOCKED / stats.total) * 100}%`,
                  }}
                />
              )}
              {stats.SKIP > 0 && (
                <div
                  className="h-full"
                  style={{
                    backgroundColor: RESULT_COLORS.SKIP,
                    width: `${(stats.SKIP / stats.total) * 100}%`,
                  }}
                />
              )}
              {stats.NOT_RUN > 0 && (
                <div
                  className="h-full"
                  style={{
                    backgroundColor: RESULT_COLORS.NOT_RUN,
                    width: `${(stats.NOT_RUN / stats.total) * 100}%`,
                  }}
                />
              )}
            </div>
            <span className="text-sm font-medium shrink-0">
              {stats.completionPercent}%
            </span>
          </div>

          <div className="flex items-center gap-4 text-sm">
            <span style={{ color: RESULT_COLORS.PASS }}>Pass {stats.PASS}</span>
            <span style={{ color: RESULT_COLORS.FAIL }}>Fail {stats.FAIL}</span>
            <span style={{ color: RESULT_COLORS.BLOCKED }}>Blocked {stats.BLOCKED}</span>
            <span style={{ color: RESULT_COLORS.SKIP }}>Skip {stats.SKIP}</span>
            <span style={{ color: RESULT_COLORS.NOT_RUN }}>Not Run {stats.NOT_RUN}</span>
          </div>
        </>
      )}

      {/* Cases table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead>Test Case</TableHead>
              <TableHead className="w-[100px]">Priority</TableHead>
              <TableHead className="w-[130px]">Result</TableHead>
              <TableHead className="w-[130px]">Executed By</TableHead>
              <TableHead className="w-[140px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((ec, idx) => (
              <TableRow key={ec.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {ec.testCase.testCaseKey}
                </TableCell>
                <TableCell className="text-sm">{ec.testCase.title}</TableCell>
                <TableCell>
                  {ec.testCase.priority && (
                    <Badge variant="secondary" className="text-xs">
                      {ec.testCase.priority}
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Select
                    value={ec.result}
                    onValueChange={(val) => handleQuickResult(ec.id, val)}
                  >
                    <SelectTrigger className="h-7 text-xs w-[110px]">
                      <span
                        className="flex items-center gap-1.5"
                      >
                        <span
                          className="size-2 rounded-full shrink-0"
                          style={{ backgroundColor: RESULT_COLORS[ec.result] }}
                        />
                        <SelectValue />
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_RESULTS.map((r) => (
                        <SelectItem key={r} value={r}>
                          <span className="flex items-center gap-1.5">
                            <span
                              className="size-2 rounded-full"
                              style={{ backgroundColor: RESULT_COLORS[r] }}
                            />
                            {RESULT_LABELS[r]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {ec.executedBy
                    ? ec.executedBy.name ?? ec.executedBy.username
                    : '—'}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {(ec.result === 'NOT_RUN' || ec.result === 'IN_PROGRESS') ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onStartRunner(idx)}
                      >
                        Execute
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onStartRunner(idx)}
                      >
                        View
                      </Button>
                    )}
                    {ec.result === 'FAIL' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setBugDialogCase(ec)}
                      >
                        <Bug className="size-3.5" />
                        Bug
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {cases.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No test cases in this execution.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Bug auto-fill dialog */}
      {bugDialogCase && (
        <BugAutoFillDialog
          open={!!bugDialogCase}
          onOpenChange={(open) => {
            if (!open) setBugDialogCase(null);
          }}
          projectId={projectId}
          executionCase={bugDialogCase}
          executionName={execution.name}
          members={members}
        />
      )}
    </div>
  );
}
