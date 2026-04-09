import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
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
import type { TestExecution, TestExecutionStatus } from '@/lib/types';

export function TestExecutionsPage() {
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const { data: executions = [], isLoading } = useTestExecutions(projectId);
  const { data: members = [] } = useMembers(projectId);

  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [runnerMode, setRunnerMode] = useState(false);
  const [runnerCaseIndex, setRunnerCaseIndex] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const { data: selectedExecution } = useTestExecution(
    projectId,
    selectedExecutionId ?? '',
  );

  const executionList = (executions ?? []) as TestExecution[];

  const filteredExecutions = useMemo(() => {
    let list = executionList;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q));
    }
    if (statusFilter) {
      list = list.filter((e) => e.status === statusFilter);
    }
    return list;
  }, [executionList, search, statusFilter]);

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
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Test Executions</h1>
        <Button onClick={() => setCreateOpen(true)}>+ New Execution</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-[280px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search executions..."
            className="h-8 pl-7 text-sm"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(val) => setStatusFilter(val === 'ALL' ? '' : val)}
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
      </div>

      <ExecutionList
        executions={filteredExecutions}
        onSelectExecution={setSelectedExecutionId}
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
