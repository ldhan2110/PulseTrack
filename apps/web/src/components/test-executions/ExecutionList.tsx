import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type OnChangeFn,
  type RowSelectionState,
  flexRender,
} from '@tanstack/react-table';
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
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TestExecution, TestExecutionStatus } from '@/lib/types';

// ─── Sort header ─────────────────────────────────────────────────────────────

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

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: TestExecutionStatus }) {
  const styles: Record<TestExecutionStatus, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    COMPLETED: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  };
  const labels: Record<TestExecutionStatus, string> = {
    PENDING: 'Pending',
    IN_PROGRESS: 'In Progress',
    COMPLETED: 'Completed',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', styles[status])}>
      {labels[status]}
    </span>
  );
}

// ─── Filter fns ──────────────────────────────────────────────────────────────

const statusFilterFn = (
  row: { getValue: (id: string) => unknown },
  columnId: string,
  filterValue: string | string[],
) => {
  if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) return true;
  const val = row.getValue(columnId) as string;
  return Array.isArray(filterValue) ? filterValue.includes(val) : filterValue === val;
};

const assigneeFilterFn = (
  row: { original: TestExecution },
  _columnId: string,
  filterValue: string | string[],
) => {
  if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) return true;
  const { assigneeId } = row.original;
  return Array.isArray(filterValue) ? filterValue.includes(assigneeId) : filterValue === assigneeId;
};

const sprintFilterFn = (
  row: { original: TestExecution },
  _columnId: string,
  filterValue: string | string[],
) => {
  if (!filterValue || (Array.isArray(filterValue) && filterValue.length === 0)) return true;
  const sprintId = row.original.sprintId ?? '';
  return Array.isArray(filterValue) ? filterValue.includes(sprintId) : filterValue === sprintId;
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface ExecutionListProps {
  executions: TestExecution[];
  onSelectExecution: (id: string) => void;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
  globalFilter: string;
  onGlobalFilterChange: (value: string) => void;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ExecutionList({
  executions,
  onSelectExecution,
  sorting,
  onSortingChange,
  columnFilters,
  onColumnFiltersChange,
  globalFilter,
  onGlobalFilterChange,
  rowSelection,
  onRowSelectionChange,
}: ExecutionListProps) {
  const columns = useMemo<ColumnDef<TestExecution>[]>(
    () => [
      {
        id: 'select',
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && 'indeterminate')
            }
            onCheckedChange={(val) => table.toggleAllPageRowsSelected(!!val)}
            aria-label="Select all"
            onClick={(e) => e.stopPropagation()}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(val) => row.toggleSelected(!!val)}
            aria-label="Select row"
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
        enableColumnFilter: false,
        size: 40,
      },
      {
        accessorKey: 'executionKey',
        header: 'ID',
        cell: ({ row }) =>
          row.original.executionKey ? (
            <span className="text-xs font-mono text-muted-foreground">{row.original.executionKey}</span>
          ) : null,
        size: 100,
        enableSorting: false,
      },
      {
        accessorKey: 'name',
        header: ({ column }) => <SortHeader label="Name" column={column} />,
        cell: ({ row }) => (
          <span className="text-sm font-medium truncate block max-w-[300px]" title={row.original.name}>
            {row.original.name}
          </span>
        ),
        minSize: 200,
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <SortHeader label="Status" column={column} />,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        size: 120,
        filterFn: statusFilterFn,
        enableColumnFilter: true,
      },
      {
        id: 'assignee',
        header: 'Assignee',
        cell: ({ row }) => {
          const assignee = row.original.assignee;
          if (!assignee) return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <div className="flex items-center gap-1.5">
              {assignee.imageUrl ? (
                <img
                  src={assignee.imageUrl}
                  alt={assignee.name ?? assignee.username}
                  className="size-5 rounded-full object-cover"
                />
              ) : (
                <div className="size-5 rounded-full bg-muted flex items-center justify-center text-[10px] font-medium text-muted-foreground">
                  {(assignee.name ?? assignee.username).charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-xs truncate max-w-[100px]">
                {assignee.name ?? assignee.username}
              </span>
            </div>
          );
        },
        size: 140,
        enableSorting: false,
        filterFn: assigneeFilterFn as ColumnDef<TestExecution>['filterFn'],
        enableColumnFilter: true,
      },
      {
        id: 'progress',
        header: 'Progress',
        cell: ({ row }) => {
          const stats = row.original.stats;
          if (!stats) return <span className="text-xs text-muted-foreground">—</span>;
          return (
            <div className="flex items-center gap-2 min-w-[80px]">
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500"
                  style={{ width: `${stats.completionPercent}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {stats.completed}/{stats.total}
              </span>
            </div>
          );
        },
        size: 130,
        enableSorting: false,
      },
      {
        id: 'sprint',
        header: 'Sprint',
        cell: ({ row }) =>
          row.original.sprint ? (
            <span className="text-xs text-muted-foreground">{row.original.sprint.name}</span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
        size: 100,
        enableSorting: false,
        filterFn: sprintFilterFn as ColumnDef<TestExecution>['filterFn'],
        enableColumnFilter: true,
      },
      {
        accessorKey: 'createdAt',
        header: ({ column }) => <SortHeader label="Created" column={column} />,
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(row.original.createdAt), { addSuffix: true })}
          </span>
        ),
        size: 120,
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
      rowSelection,
    },
    enableRowSelection: true,
    onSortingChange,
    onColumnFiltersChange,
    onGlobalFilterChange,
    onRowSelectionChange,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
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
                No test executions
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="h-10 cursor-pointer hover:bg-muted/50 transition-colors duration-100"
                onClick={() => onSelectExecution(row.original.id)}
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
