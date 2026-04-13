import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { type SortingState, type ColumnFiltersState } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useUiStore } from '@/store/uiStore';
import { useTestExecutions, useTestExecution } from '@/hooks/useTestExecutions';
import { useMembers } from '@/hooks/useMembers';
import { ExecutionList } from '@/components/test-executions/ExecutionList';
import { ExecutionDetail } from '@/components/test-executions/ExecutionDetail';
import { ExecutionRunner } from '@/components/test-executions/ExecutionRunner';
import { CreateExecutionDialog } from '@/components/test-executions/CreateExecutionDialog';
import type { TestExecution } from '@/lib/types';

export function TestExecutionsPage() {
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const { data: executions = [] } = useTestExecutions(projectId);
  const { data: members = [] } = useMembers(projectId);

  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [runnerMode, setRunnerMode] = useState(false);
  const [runnerCaseIndex, setRunnerCaseIndex] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);

  // Table state
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');

  const { data: selectedExecution } = useTestExecution(
    projectId,
    selectedExecutionId ?? '',
  );

  const executionList = (executions ?? []) as TestExecution[];

  // Derive unique sprints from execution data for the sprint filter
  const sprintOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const exec of executionList) {
      if (exec.sprint) {
        map.set(exec.sprint.id, exec.sprint.name);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [executionList]);

  // Helper to get/set a specific column filter value
  const getColumnFilterValue = (columnId: string): string =>
    (columnFilters.find((f) => f.id === columnId)?.value as string) ?? '';

  const setColumnFilter = (columnId: string, value: string) => {
    setColumnFilters((prev) => {
      const existing = prev.filter((f) => f.id !== columnId);
      if (!value) return existing;
      return [...existing, { id: columnId, value }];
    });
  };

  // Runner view
  if (runnerMode && selectedExecution && selectedExecution.cases) {
    return (
      <ExecutionRunner
        projectId={projectId}
        executionCases={selectedExecution.cases}
        executionName={selectedExecution.name}
        initialCaseIndex={runnerCaseIndex}
        onBack={() => setRunnerMode(false)}
        members={members}
      />
    );
  }

  // Detail view
  if (selectedExecutionId && selectedExecution) {
    return (
      <ExecutionDetail
        projectId={projectId}
        execution={selectedExecution}
        onStartRunner={(idx) => {
          setRunnerCaseIndex(idx);
          setRunnerMode(true);
        }}
        onBack={() => setSelectedExecutionId(null)}
        members={members}
      />
    );
  }

  // List view
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Test Executions</h1>
        <Button onClick={() => setCreateOpen(true)}>+ New Execution</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-[280px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search executions..."
            className="h-8 pl-7 text-sm"
          />
        </div>
        <Select
          value={getColumnFilterValue('status') || 'ALL'}
          onValueChange={(val) => setColumnFilter('status', val === 'ALL' ? '' : val)}
        >
          <SelectTrigger className="h-8 w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={getColumnFilterValue('assignee') || 'ALL'}
          onValueChange={(val) => setColumnFilter('assignee', val === 'ALL' ? '' : val)}
        >
          <SelectTrigger className="h-8 w-[150px]">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All assignees</SelectItem>
            {members.map((m) => (
              <SelectItem key={m.userId} value={m.userId}>
                {m.user.name ?? m.user.username}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {sprintOptions.length > 0 && (
          <Select
            value={getColumnFilterValue('sprint') || 'ALL'}
            onValueChange={(val) => setColumnFilter('sprint', val === 'ALL' ? '' : val)}
          >
            <SelectTrigger className="h-8 w-[150px]">
              <SelectValue placeholder="Sprint" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All sprints</SelectItem>
              {sprintOptions.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <ExecutionList
        executions={executionList}
        onSelectExecution={setSelectedExecutionId}
        sorting={sorting}
        onSortingChange={setSorting}
        columnFilters={columnFilters}
        onColumnFiltersChange={setColumnFilters}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
      />

      <CreateExecutionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId}
        members={members}
      />
    </div>
  );
}
