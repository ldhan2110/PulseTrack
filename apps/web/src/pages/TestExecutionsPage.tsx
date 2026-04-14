import { useMemo, useState } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { type SortingState, type ColumnFiltersState } from '@tanstack/react-table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useUiStore } from '@/store/uiStore';
import { useTestExecutions, useTestExecution } from '@/hooks/useTestExecutions';
import { useMembers } from '@/hooks/useMembers';
import { ExecutionList } from '@/components/test-executions/ExecutionList';
import { ExecutionDetail } from '@/components/test-executions/ExecutionDetail';
import { ExecutionRunner } from '@/components/test-executions/ExecutionRunner';
import { CreateExecutionDialog } from '@/components/test-executions/CreateExecutionDialog';
import type { TestExecution } from '@/lib/types';

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

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
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [sprintSearch, setSprintSearch] = useState('');

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

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Search executions..."
            className="pl-8 h-8 w-[200px] text-sm"
          />
        </div>

        {/* Status filter */}
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

        {/* Assignee filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'h-8 gap-1.5',
                getColumnFilterValue('assignee') && 'border-primary',
              )}
            >
              Assignee
              {getColumnFilterValue('assignee') && (
                <Badge variant="secondary" className="size-5 p-0 flex items-center justify-center text-[10px] rounded-full">
                  1
                </Badge>
              )}
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-2" align="start" onCloseAutoFocus={() => setAssigneeSearch('')}>
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search..."
                value={assigneeSearch}
                onChange={(e) => setAssigneeSearch(e.target.value)}
                className="pl-7 h-7 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
              {(!assigneeSearch || 'all assignees'.includes(assigneeSearch.toLowerCase())) && (
                <button
                  type="button"
                  onClick={() => setColumnFilter('assignee', '')}
                  className={cn(
                    'flex items-center rounded px-2 py-1.5 hover:bg-muted text-sm text-left w-full',
                    !getColumnFilterValue('assignee') && 'font-medium',
                  )}
                >
                  All assignees
                </button>
              )}
              {members
                .filter((m) => {
                  if (!assigneeSearch) return true;
                  const name = (m.user.name ?? m.user.username).toLowerCase();
                  return name.includes(assigneeSearch.toLowerCase());
                })
                .map((m) => (
                  <button
                    key={m.userId}
                    type="button"
                    onClick={() => setColumnFilter('assignee', m.userId)}
                    className={cn(
                      'flex items-center gap-2 rounded px-2 py-1.5 hover:bg-muted text-sm text-left w-full',
                      getColumnFilterValue('assignee') === m.userId && 'font-medium',
                    )}
                  >
                    <Avatar className="size-5">
                      {m.user.imageUrl && <AvatarImage src={m.user.imageUrl} alt={m.user.name ?? m.user.username} />}
                      <AvatarFallback className="text-[9px]">
                        {getInitials(m.user.name ?? m.user.username)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate">{m.user.name ?? m.user.username}</span>
                  </button>
                ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Sprint filter */}
        {sprintOptions.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn(
                  'h-8 gap-1.5',
                  getColumnFilterValue('sprint') && 'border-primary',
                )}
              >
                Sprint
                {getColumnFilterValue('sprint') && (
                  <Badge variant="secondary" className="size-5 p-0 flex items-center justify-center text-[10px] rounded-full">
                    1
                  </Badge>
                )}
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-2" align="start" onCloseAutoFocus={() => setSprintSearch('')}>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-muted-foreground pointer-events-none" />
                <Input
                  placeholder="Search..."
                  value={sprintSearch}
                  onChange={(e) => setSprintSearch(e.target.value)}
                  className="pl-7 h-7 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
                {(!sprintSearch || 'all sprints'.includes(sprintSearch.toLowerCase())) && (
                  <button
                    type="button"
                    onClick={() => setColumnFilter('sprint', '')}
                    className={cn(
                      'flex items-center rounded px-2 py-1.5 hover:bg-muted text-sm text-left w-full',
                      !getColumnFilterValue('sprint') && 'font-medium',
                    )}
                  >
                    All sprints
                  </button>
                )}
                {sprintOptions
                  .filter((s) => {
                    if (!sprintSearch) return true;
                    return s.name.toLowerCase().includes(sprintSearch.toLowerCase());
                  })
                  .map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setColumnFilter('sprint', s.id)}
                      className={cn(
                        'flex items-center rounded px-2 py-1.5 hover:bg-muted text-sm text-left w-full truncate',
                        getColumnFilterValue('sprint') === s.id && 'font-medium',
                      )}
                    >
                      {s.name}
                    </button>
                  ))}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Clear filters */}
        {(getColumnFilterValue('status') || getColumnFilterValue('assignee') || getColumnFilterValue('sprint') || globalFilter) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-muted-foreground"
            onClick={() => {
              setColumnFilters([]);
              setGlobalFilter('');
            }}
          >
            <X className="size-3.5" />
            Clear Filters
          </Button>
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
