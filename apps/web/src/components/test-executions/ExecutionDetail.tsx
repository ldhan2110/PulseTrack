import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type SortingState,
  flexRender,
} from '@tanstack/react-table';
import { ArrowLeft, ArrowUp, ArrowDown, ArrowUpDown, Play } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ExecutionStatsBar } from './ExecutionStatsBar';
import { useUpdateExecutionCaseResult } from '@/hooks/useTestExecutions';
import type { TestExecution, TestExecutionCase, TestResultStatus, Member } from '@/lib/types';
import type { ReactNode } from 'react';

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

const RESULT_STYLES: Record<TestResultStatus, string> = {
  NOT_RUN: 'bg-muted text-muted-foreground',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  PASS: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  FAIL: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  BLOCKED: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  SKIP: 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400',
};

const RESULT_OPTIONS: TestResultStatus[] = ['NOT_RUN', 'IN_PROGRESS', 'PASS', 'FAIL', 'BLOCKED', 'SKIP'];

function ResultBadge({ result }: { result: TestResultStatus }) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', RESULT_STYLES[result])}>
      {result.replace('_', ' ')}
    </span>
  );
}

interface SortHeaderProps {
  label: string;
  column: { getIsSorted: () => false | 'asc' | 'desc'; toggleSorting: (desc?: boolean) => void };
}

function SortHeader({ label, column }: SortHeaderProps) {
  const sorted = column.getIsSorted();
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-2 h-7 gap-1 text-[13px] font-semibold"
      onClick={() => column.toggleSorting(sorted === 'asc')}
    >
      {label}
      {sorted === 'asc' ? <ArrowUp className="size-3" /> : sorted === 'desc' ? <ArrowDown className="size-3" /> : <ArrowUpDown className="size-3 text-muted-foreground" />}
    </Button>
  );
}

interface ExecutionDetailProps {
  projectId: string;
  execution: TestExecution;
  onStartRunner: (idx: number) => void;
  onBack: () => void;
  members: Member[];
  deleteButton?: ReactNode;
}

export function ExecutionDetail({
  projectId,
  execution,
  onStartRunner,
  onBack,
  deleteButton,
}: ExecutionDetailProps) {
  const cases = execution.cases ?? [];
  const stats = execution.stats;
  const updateResult = useUpdateExecutionCaseResult(projectId);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [resultFilter, setResultFilter] = useState<string>('ALL');

  const handleResultChange = (executionCaseId: string, result: TestResultStatus) => {
    updateResult.mutate({ executionCaseId, data: { result } });
  };

  const firstNotRunIndex = cases.findIndex((c) => c.result === 'NOT_RUN');

  const columns = useMemo<ColumnDef<TestExecutionCase>[]>(
    () => [
      {
        accessorFn: (row) => row.testCase.testCaseKey,
        id: 'caseKey',
        header: ({ column }) => <SortHeader label="Key" column={column} />,
        cell: ({ row }) => (
          <span className="text-xs font-mono text-muted-foreground">
            {row.original.testCase.testCaseKey}
          </span>
        ),
        size: 100,
      },
      {
        accessorFn: (row) => row.testCase.title,
        id: 'title',
        header: ({ column }) => <SortHeader label="Title" column={column} />,
        cell: ({ row }) => (
          <span className="text-sm font-medium truncate block max-w-[300px]" title={row.original.testCase.title}>
            {row.original.testCase.title}
          </span>
        ),
        minSize: 200,
      },
      {
        accessorKey: 'result',
        header: ({ column }) => <SortHeader label="Result" column={column} />,
        cell: ({ row }) => (
          <Select
            value={row.original.result}
            onValueChange={(v) => handleResultChange(row.original.id, v as TestResultStatus)}
          >
            <SelectTrigger
              className="h-6 w-[110px] border-0 bg-transparent p-0 focus:ring-0"
              onClick={(e) => e.stopPropagation()}
            >
              <ResultBadge result={row.original.result} />
            </SelectTrigger>
            <SelectContent>
              {RESULT_OPTIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  <ResultBadge result={r} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
        size: 130,
        filterFn: (row, _columnId, filterValue) => {
          if (!filterValue || filterValue === 'ALL') return true;
          return row.original.result === filterValue;
        },
      },
      {
        id: 'executedBy',
        header: 'Executed By',
        cell: ({ row }) => {
          const user = row.original.executedBy;
          if (!user) return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <div className="flex items-center gap-1.5">
              <Avatar className="size-5">
                {user.imageUrl && <AvatarImage src={user.imageUrl} />}
                <AvatarFallback className="text-[9px]">
                  {getInitials(user.name ?? user.username)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs truncate max-w-[80px]">{user.name ?? user.username}</span>
            </div>
          );
        },
        size: 120,
        enableSorting: false,
      },
      {
        id: 'notes',
        header: 'Notes',
        cell: ({ row }) =>
          row.original.notes ? (
            <span className="text-xs text-muted-foreground truncate block max-w-[150px]">
              {row.original.notes}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
        size: 150,
        enableSorting: false,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const idx = cases.findIndex((c) => c.id === row.original.id);
          return (
            <Button
              variant="ghost"
              size="sm"
              className="size-7 p-0"
              onClick={(e) => {
                e.stopPropagation();
                onStartRunner(idx);
              }}
              title="Open in runner"
            >
              <Play className="size-3.5" />
            </Button>
          );
        },
        size: 40,
        enableSorting: false,
      },
    ],
    [cases, updateResult],
  );

  const table = useReactTable({
    data: cases,
    columns,
    state: {
      sorting,
      columnFilters: resultFilter !== 'ALL' ? [{ id: 'result', value: resultFilter }] : [],
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const assignee = execution.assignee;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="size-8 p-0" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {execution.executionKey && (
            <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
              {execution.executionKey}
            </span>
          )}
          <h1 className="text-lg font-semibold truncate">{execution.name}</h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => onStartRunner(firstNotRunIndex >= 0 ? firstNotRunIndex : 0)}
          >
            <Play className="size-3.5" />
            Start Runner
          </Button>
          {deleteButton}
        </div>
      </div>

      {/* Stats */}
      {stats && <ExecutionStatsBar stats={stats} />}

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        <Select value={resultFilter} onValueChange={setResultFilter}>
          <SelectTrigger className="h-8 w-[150px]">
            <SelectValue placeholder="Filter results" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All results</SelectItem>
            {RESULT_OPTIONS.map((r) => (
              <SelectItem key={r} value={r}>{r.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Cases table */}
      <div className="rounded-lg border overflow-hidden">
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id} className="bg-muted/50 hover:bg-muted/50">
                  {hg.headers.map((header) => (
                    <TableHead
                      key={header.id}
                      style={{ width: header.column.getSize() !== 150 ? header.column.getSize() : undefined }}
                      className="h-10"
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground text-sm">
                    No test cases in this execution
                  </TableCell>
                </TableRow>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const idx = cases.findIndex((c) => c.id === row.original.id);
                  return (
                    <TableRow
                      key={row.id}
                      className="h-10 cursor-pointer hover:bg-muted/50 transition-colors duration-100"
                      onClick={() => onStartRunner(idx)}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id} className="py-0">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-6 text-xs text-muted-foreground border-t pt-3">
        {assignee && (
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-foreground">Assignee:</span>
            <Avatar className="size-4">
              {assignee.imageUrl && <AvatarImage src={assignee.imageUrl} />}
              <AvatarFallback className="text-[8px]">{getInitials(assignee.name ?? assignee.username)}</AvatarFallback>
            </Avatar>
            {assignee.name ?? assignee.username}
          </div>
        )}
        {execution.sprint && (
          <div>
            <span className="font-medium text-foreground">Sprint:</span> {execution.sprint.name}
          </div>
        )}
        <div>
          <span className="font-medium text-foreground">Created:</span>{' '}
          {formatDistanceToNow(new Date(execution.createdAt), { addSuffix: true })}
        </div>
      </div>
    </div>
  );
}
