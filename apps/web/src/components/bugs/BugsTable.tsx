import { useMemo } from 'react';
import { Link } from 'react-router-dom';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Bug, BugSeverity } from '@/lib/types';

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Severity badge with CSS variable colors per UI-SPEC
function SeverityBadge({ severity }: { severity: BugSeverity }) {
  const styles: Record<BugSeverity, string> = {
    CRITICAL: 'bg-[color-mix(in_oklch,var(--severity-critical)_15%,transparent)] text-[var(--severity-critical)]',
    HIGH: 'bg-[color-mix(in_oklch,var(--severity-high)_15%,transparent)] text-[var(--severity-high)]',
    MEDIUM: 'bg-[color-mix(in_oklch,var(--severity-medium)_15%,transparent)] text-[var(--severity-medium)]',
    LOW: 'bg-[color-mix(in_oklch,var(--severity-low)_15%,transparent)] text-[var(--severity-low)]',
  };
  const labels: Record<BugSeverity, string> = {
    CRITICAL: 'Critical',
    HIGH: 'High',
    MEDIUM: 'Medium',
    LOW: 'Low',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', styles[severity])}>
      {labels[severity]}
    </span>
  );
}

// Export for use in BugFilters
export { SeverityBadge };

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

export const severityFilterFn = (
  row: { getValue: (id: string) => unknown },
  columnId: string,
  filterValue: BugSeverity[],
) => {
  if (!filterValue || filterValue.length === 0) return true;
  return filterValue.includes(row.getValue(columnId) as BugSeverity);
};

export const bugStatusFilterFn = (
  row: { getValue: (id: string) => unknown },
  columnId: string,
  filterValue: string[],
) => {
  if (!filterValue || filterValue.length === 0) return true;
  return filterValue.includes(row.getValue(columnId) as string);
};

export const bugAssigneeFilterFn = (
  row: { getValue: (id: string) => unknown },
  columnId: string,
  filterValue: string[],
) => {
  if (!filterValue || filterValue.length === 0) return true;
  const val = row.getValue(columnId) as string | null;
  if (filterValue.includes('unassigned') && (val === null || val === undefined)) return true;
  if (val && filterValue.includes(val)) return true;
  return false;
};

interface BugsTableProps {
  bugs: Bug[];
  projectId: string;
  projectPrefix: string;
  isLoading?: boolean;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
  globalFilter: string;
  onGlobalFilterChange: (val: string) => void;
}

export function BugsTable({
  bugs,
  projectId: _projectId,
  projectPrefix,
  isLoading,
  sorting,
  onSortingChange,
  columnFilters,
  onColumnFiltersChange,
  globalFilter,
  onGlobalFilterChange,
}: BugsTableProps) {

  const columns = useMemo<ColumnDef<Bug>[]>(
    () => [
      {
        accessorKey: 'bugKey',
        header: 'Key',
        cell: ({ row }) =>
          row.original.bugKey ? (
            <span className="text-xs font-mono text-muted-foreground">{row.original.bugKey}</span>
          ) : null,
        size: 120,
        enableSorting: false,
      },
      {
        accessorKey: 'title',
        header: ({ column }) => <SortHeader label="Title" column={column} />,
        cell: ({ row }) => (
          <span className="text-sm font-medium truncate block max-w-[400px]" title={row.original.title}>
            {row.original.title}
          </span>
        ),
        minSize: 200,
      },
      {
        accessorKey: 'severity',
        header: ({ column }) => <SortHeader label="Severity" column={column} />,
        cell: ({ row }) => <SeverityBadge severity={row.original.severity} />,
        size: 100,
        filterFn: severityFilterFn,
        enableColumnFilter: true,
      },
      {
        accessorKey: 'workflowStatusId',
        header: ({ column }) => <SortHeader label="Status" column={column} />,
        cell: ({ row }) =>
          row.original.workflowStatus ? (
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ backgroundColor: row.original.workflowStatus.color }} />
              <span className="text-xs">{row.original.workflowStatus.name}</span>
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
        size: 120,
        filterFn: bugStatusFilterFn,
        enableColumnFilter: true,
      },
      {
        accessorKey: 'assigneeId',
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
        filterFn: bugAssigneeFilterFn,
        enableColumnFilter: true,
      },
      {
        accessorKey: 'reporterId',
        header: 'Reporter',
        cell: ({ row }) => {
          const reporter = row.original.reporter;
          if (!reporter) {
            return <span className="text-sm text-muted-foreground">—</span>;
          }
          return (
            <div className="flex items-center gap-2">
              <Avatar className="size-6">
                {reporter.imageUrl && <AvatarImage src={reporter.imageUrl} alt={reporter.name ?? reporter.username} />}
                <AvatarFallback className="text-[10px]">{getInitials(reporter.name ?? reporter.username)}</AvatarFallback>
              </Avatar>
              <span className="text-sm truncate">{reporter.name ?? reporter.username}</span>
            </div>
          );
        },
        size: 140,
        enableSorting: false,
      },
      {
        id: 'linkedTasks',
        header: 'Linked Tasks',
        cell: ({ row }) => {
          const bugTasks = row.original.bugTasks ?? [];
          if (bugTasks.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-1">
              {bugTasks.map((bt) => (
                <Link
                  key={bt.task.id}
                  to={`/projects/${projectPrefix}/tasks/${bt.task.taskKey}`}
                  className="text-xs text-primary hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {bt.task.taskKey}
                </Link>
              ))}
            </div>
          );
        },
        size: 120,
        enableSorting: false,
      },
    ],
    [projectPrefix],
  );

  const table = useReactTable({
    data: bugs,
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

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
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
                No matching bugs
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="h-10 cursor-pointer hover:bg-muted/50 transition-colors duration-100"
                onClick={() => window.open(`/projects/${projectPrefix}/bugs/${row.original.bugKey ?? row.original.id}`, '_blank')}
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
