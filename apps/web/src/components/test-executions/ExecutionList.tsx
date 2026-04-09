import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type OnChangeFn,
  flexRender,
} from '@tanstack/react-table';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown, ClipboardList } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { TestExecution, TestResultStatus } from '@/lib/types';

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// ─── Sort header matching BugsTable / TestCasesTable pattern ─────────────────

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
      {sorted === 'asc' ? (
        <ArrowUp className="size-3" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="size-3" />
      ) : (
        <ArrowUpDown className="size-3 text-muted-foreground" />
      )}
    </Button>
  );
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { className: string; label: string }> = {
  PENDING: { className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400', label: 'Pending' },
  IN_PROGRESS: { className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', label: 'In Progress' },
  COMPLETED: { className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400', label: 'Completed' },
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

// ─── Filter functions ────────────────────────────────────────────────────────

export const statusFilterFn = (
  row: { getValue: (id: string) => unknown },
  columnId: string,
  filterValue: string,
) => {
  if (!filterValue) return true;
  return row.getValue(columnId) === filterValue;
};

export const assigneeFilterFn = (
  row: { getValue: (id: string) => unknown },
  columnId: string,
  filterValue: string,
) => {
  if (!filterValue) return true;
  return row.getValue(columnId) === filterValue;
};

export const sprintFilterFn = (
  row: { getValue: (id: string) => unknown },
  columnId: string,
  filterValue: string,
) => {
  if (!filterValue) return true;
  return row.getValue(columnId) === filterValue;
};

// ─── Table ───────────────────────────────────────────────────────────────────

interface ExecutionListProps {
  executions: TestExecution[];
  onSelectExecution: (id: string) => void;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
  globalFilter: string;
  onGlobalFilterChange: (val: string) => void;
}

export function ExecutionList({
  executions,
  onSelectExecution,
  sorting,
  onSortingChange,
  columnFilters,
  onColumnFiltersChange,
  globalFilter,
  onGlobalFilterChange,
}: ExecutionListProps) {
  const navigate = useNavigate();
  const { projectPrefix } = useParams<{ projectPrefix: string }>();

  const columns = useMemo<ColumnDef<TestExecution>[]>(
    () => [
      {
        accessorKey: 'executionKey',
        header: ({ column }) => <SortHeader label="ID" column={column} />,
        cell: ({ row }) => (
          <span className="font-mono text-xs text-muted-foreground">
            {row.original.executionKey ?? '—'}
          </span>
        ),
        size: 110,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <SortHeader label="Name" column={column} />,
        cell: ({ row }) => (
          <span className="text-sm font-medium text-primary truncate block max-w-[260px]" title={row.original.name}>
            {row.original.name}
          </span>
        ),
        minSize: 200,
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <SortHeader label="Status" column={column} />,
        cell: ({ row }) => {
          const info = STATUS_BADGE[row.original.status] ?? STATUS_BADGE.PENDING;
          return (
            <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', info.className)}>
              {info.label}
            </span>
          );
        },
        size: 110,
        filterFn: statusFilterFn,
        enableColumnFilter: true,
      },
      {
        id: 'assignee',
        accessorFn: (row) => row.assigneeId,
        header: ({ column }) => <SortHeader label="Assignee" column={column} />,
        cell: ({ row }) => {
          const assignee = row.original.assignee;
          if (!assignee) {
            return <span className="text-sm text-muted-foreground">Unassigned</span>;
          }
          return (
            <div className="flex items-center gap-2">
              <Avatar className="size-6">
                {assignee.imageUrl && <AvatarImage src={assignee.imageUrl} alt={assignee.name ?? assignee.username} />}
                <AvatarFallback className="text-[10px]">{getInitials(assignee.name ?? assignee.username)}</AvatarFallback>
              </Avatar>
              <span className="text-sm truncate">{assignee.name ?? assignee.username}</span>
            </div>
          );
        },
        size: 140,
        filterFn: assigneeFilterFn,
        enableColumnFilter: true,
      },
      {
        id: 'sprint',
        accessorFn: (row) => row.sprintId ?? '',
        header: ({ column }) => <SortHeader label="Sprint" column={column} />,
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.sprint?.name ?? '—'}
          </span>
        ),
        size: 120,
        filterFn: sprintFilterFn,
        enableColumnFilter: true,
      },
      {
        id: 'progress',
        accessorFn: (row) => row.stats?.completionPercent ?? 0,
        header: ({ column }) => <SortHeader label="Progress" column={column} />,
        cell: ({ row }) => {
          const stats = row.original.stats;
          const total = stats?.total ?? 0;
          const pct = stats?.completionPercent ?? 0;
          return (
            <div className="flex items-center gap-2 min-w-[120px]">
              <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-muted flex">
                {total > 0 && (
                  <>
                    {stats!.PASS > 0 && (
                      <div className="h-full" style={{ backgroundColor: RESULT_COLORS.PASS, width: `${(stats!.PASS / total) * 100}%` }} />
                    )}
                    {stats!.FAIL > 0 && (
                      <div className="h-full" style={{ backgroundColor: RESULT_COLORS.FAIL, width: `${(stats!.FAIL / total) * 100}%` }} />
                    )}
                    {stats!.BLOCKED > 0 && (
                      <div className="h-full" style={{ backgroundColor: RESULT_COLORS.BLOCKED, width: `${(stats!.BLOCKED / total) * 100}%` }} />
                    )}
                    {stats!.SKIP > 0 && (
                      <div className="h-full" style={{ backgroundColor: RESULT_COLORS.SKIP, width: `${(stats!.SKIP / total) * 100}%` }} />
                    )}
                  </>
                )}
              </div>
              <span className="text-xs text-muted-foreground tabular-nums w-[34px] text-right">{pct}%</span>
            </div>
          );
        },
        size: 160,
      },
      {
        id: 'results',
        header: 'Results',
        cell: ({ row }) => {
          const stats = row.original.stats;
          if (!stats) return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <div className="flex gap-2 text-[11px] font-medium tabular-nums">
              <span style={{ color: RESULT_COLORS.PASS }}>✓{stats.PASS}</span>
              <span style={{ color: RESULT_COLORS.FAIL }}>✗{stats.FAIL}</span>
              <span style={{ color: RESULT_COLORS.BLOCKED }}>⊘{stats.BLOCKED}</span>
              {stats.SKIP > 0 && <span style={{ color: RESULT_COLORS.SKIP }}>⊘{stats.SKIP}</span>}
              <span style={{ color: RESULT_COLORS.NOT_RUN }}>–{stats.NOT_RUN}</span>
            </div>
          );
        },
        size: 160,
        enableSorting: false,
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => <SortHeader label="Created" column={column} />,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">{formatDate(row.original.createdAt)}</span>
        ),
        size: 100,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: executions,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange,
    onColumnFiltersChange,
    onGlobalFilterChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

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
    <div className="rounded-lg border overflow-hidden">
      <Table containerClassName="max-h-[calc(100vh-220px)]">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id} className="bg-muted/50 hover:bg-muted/50">
              {headerGroup.headers.map((header) => (
                <TableHead
                  key={header.id}
                  style={{ width: header.column.getSize() !== 150 ? header.column.getSize() : undefined }}
                  className="h-10"
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground text-sm">
                No matching executions
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="h-10 cursor-pointer hover:bg-muted/50 transition-colors duration-100"
                onClick={() => {
                  if (projectPrefix && row.original.executionKey) {
                    navigate(`/projects/${projectPrefix}/test-executions/${row.original.executionKey}`);
                  } else {
                    onSelectExecution(row.original.id);
                  }
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="py-0">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
