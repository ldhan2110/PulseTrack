import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { ClipboardList } from 'lucide-react';
import type { TestExecution, TestResultStatus } from '@/lib/types';

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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface ExecutionListProps {
  executions: TestExecution[];
  onSelectExecution: (id: string) => void;
}

export function ExecutionList({ executions, onSelectExecution }: ExecutionListProps) {
  if (executions.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="flex flex-col items-center gap-4 max-w-[360px] text-center">
          <ClipboardList className="size-12 text-muted-foreground" />
          <div>
            <h2 className="text-[20px] font-semibold">No test executions yet</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Create a test execution to start running your test cases.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {executions.map((exec) => {
        const statusInfo = STATUS_BADGE[exec.status] ?? STATUS_BADGE.PENDING;
        const stats = exec.stats;
        const total = stats?.total ?? 0;
        const completed = stats?.completed ?? 0;
        const pct = stats?.completionPercent ?? 0;

        return (
          <Card
            key={exec.id}
            className="cursor-pointer hover:border-foreground/20 transition-colors"
            onClick={() => onSelectExecution(exec.id)}
          >
            <CardContent className="p-4 flex flex-col gap-3">
              {/* Title row */}
              <div className="flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold leading-tight truncate flex-1">
                  {exec.name}
                </h3>
                <Badge variant="secondary" className={cn('text-[10px] shrink-0', statusInfo.className)}>
                  {statusInfo.label}
                </Badge>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {exec.assignee && (
                  <span>{exec.assignee.name ?? exec.assignee.username}</span>
                )}
                {exec.sprint && (
                  <>
                    <span>·</span>
                    <span>{exec.sprint.name}</span>
                  </>
                )}
              </div>

              {/* Completion */}
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold">{pct}%</span>
                <span className="text-xs text-muted-foreground">
                  {completed}/{total} cases done
                </span>
              </div>

              {/* Progress bar */}
              {stats && total > 0 && (
                <div className="h-2 rounded-full overflow-hidden bg-muted flex">
                  {stats.PASS > 0 && (
                    <div
                      className="h-full"
                      style={{
                        backgroundColor: RESULT_COLORS.PASS,
                        width: `${(stats.PASS / total) * 100}%`,
                      }}
                    />
                  )}
                  {stats.FAIL > 0 && (
                    <div
                      className="h-full"
                      style={{
                        backgroundColor: RESULT_COLORS.FAIL,
                        width: `${(stats.FAIL / total) * 100}%`,
                      }}
                    />
                  )}
                  {stats.BLOCKED > 0 && (
                    <div
                      className="h-full"
                      style={{
                        backgroundColor: RESULT_COLORS.BLOCKED,
                        width: `${(stats.BLOCKED / total) * 100}%`,
                      }}
                    />
                  )}
                  {stats.SKIP > 0 && (
                    <div
                      className="h-full"
                      style={{
                        backgroundColor: RESULT_COLORS.SKIP,
                        width: `${(stats.SKIP / total) * 100}%`,
                      }}
                    />
                  )}
                  {stats.NOT_RUN > 0 && (
                    <div
                      className="h-full"
                      style={{
                        backgroundColor: RESULT_COLORS.NOT_RUN,
                        width: `${(stats.NOT_RUN / total) * 100}%`,
                      }}
                    />
                  )}
                </div>
              )}

              {/* Result counts */}
              {stats && (
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]">
                  <span style={{ color: RESULT_COLORS.PASS }}>Pass {stats.PASS}</span>
                  <span style={{ color: RESULT_COLORS.FAIL }}>Fail {stats.FAIL}</span>
                  <span style={{ color: RESULT_COLORS.BLOCKED }}>Blocked {stats.BLOCKED}</span>
                  <span style={{ color: RESULT_COLORS.SKIP }}>Skip {stats.SKIP}</span>
                  <span style={{ color: RESULT_COLORS.NOT_RUN }}>Not Run {stats.NOT_RUN}</span>
                </div>
              )}

              {/* Date */}
              <p className="text-[11px] text-muted-foreground">
                Created {formatDate(exec.createdAt)}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
