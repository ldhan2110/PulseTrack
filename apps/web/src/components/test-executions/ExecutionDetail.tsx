import { useState } from 'react';
import { ArrowLeft, Play, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

const RESULT_TAG_STYLES: Record<TestResultStatus, string> = {
  PASS: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  FAIL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  BLOCKED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  SKIP: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
  NOT_RUN: 'bg-muted text-muted-foreground',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
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
  deleteButton?: React.ReactNode;
}

export function ExecutionDetail({
  projectId,
  execution,
  onStartRunner,
  onBack,
  members,
  deleteButton,
}: ExecutionDetailProps) {
  const [bugDialogCase, setBugDialogCase] = useState<TestExecutionCase | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingNoteValue, setEditingNoteValue] = useState('');
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

  const handleNoteSave = (executionCase: TestExecutionCase) => {
    updateResult.mutate({
      executionCaseId: executionCase.id,
      data: { result: executionCase.result, notes: editingNoteValue },
    });
    setEditingNoteId(null);
  };

  return (
    <div className="flex flex-col gap-4">
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
          {deleteButton}
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
      <div className="rounded-md border overflow-auto max-h-[calc(100vh-200px)]">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-background">
            <TableRow>
              <TableHead className="w-[100px]">ID</TableHead>
              <TableHead className="max-w-[250px]">Test Case</TableHead>
              <TableHead className="w-[100px]">Priority</TableHead>
              <TableHead className="w-[130px]">Result</TableHead>
              <TableHead className="w-[130px]">Executed By</TableHead>
              <TableHead className="w-[150px]">Notes</TableHead>
              <TableHead className="w-[140px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((ec, idx) => (
              <TableRow key={ec.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {ec.testCase.testCaseKey}
                </TableCell>
                <TableCell className="text-sm max-w-[250px]">
                  <span className="truncate block" title={ec.testCase.title}>{ec.testCase.title}</span>
                </TableCell>
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
                    <SelectTrigger
                      className={cn(
                        'h-6 w-auto border-0 px-2 py-0 text-[11px] font-medium rounded-full shadow-none focus:ring-0 gap-1',
                        RESULT_TAG_STYLES[ec.result],
                      )}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      {RESULT_LABELS[ec.result]}
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={4}>
                      {ALL_RESULTS.map((r) => (
                        <SelectItem key={r} value={r}>
                          <span className={cn(
                            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
                            RESULT_TAG_STYLES[r],
                          )}>
                            {RESULT_LABELS[r]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {ec.executedBy ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar className="size-5">
                        {ec.executedBy.imageUrl && <AvatarImage src={ec.executedBy.imageUrl} />}
                        <AvatarFallback className="text-[9px]">
                          {(ec.executedBy.name ?? ec.executedBy.username).split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate max-w-[80px]">{ec.executedBy.name ?? ec.executedBy.username}</span>
                    </div>
                  ) : '—'}
                </TableCell>
                <TableCell>
                  {editingNoteId === ec.id ? (
                    <Input
                      autoFocus
                      value={editingNoteValue}
                      onChange={(e) => setEditingNoteValue(e.target.value)}
                      onBlur={() => handleNoteSave(ec)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleNoteSave(ec);
                        if (e.key === 'Escape') setEditingNoteId(null);
                      }}
                      className="h-7 text-xs px-1.5"
                    />
                  ) : (
                    <span
                      className="text-xs text-muted-foreground truncate block max-w-[140px] cursor-text hover:text-foreground"
                      title="Click to edit"
                      onClick={() => {
                        setEditingNoteId(ec.id);
                        setEditingNoteValue(ec.notes ?? '');
                      }}
                    >
                      {ec.notes || '—'}
                    </span>
                  )}
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
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
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
