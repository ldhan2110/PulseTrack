import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TestCase, Priority, TestCaseStatus } from '@/lib/types';

// ─── Sort header matching BugsTable pattern ──────────────────────────────────

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

// ─── Badges ──────────────────────────────────────────────────────────────────

function PriorityBadge({ priority }: { priority: Priority }) {
  const styles: Record<Priority, string> = {
    BLOCKER: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    CRITICAL: 'bg-[color-mix(in_oklch,var(--severity-critical)_15%,transparent)] text-[var(--severity-critical)]',
    HIGH: 'bg-[color-mix(in_oklch,var(--severity-high)_15%,transparent)] text-[var(--severity-high)]',
    MEDIUM: 'bg-[color-mix(in_oklch,var(--severity-medium)_15%,transparent)] text-[var(--severity-medium)]',
    LOW: 'bg-[color-mix(in_oklch,var(--severity-low)_15%,transparent)] text-[var(--severity-low)]',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', styles[priority])}>
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </span>
  );
}

function StatusBadge({ status }: { status: TestCaseStatus }) {
  const styles: Record<TestCaseStatus, string> = {
    DRAFT: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
    ACTIVE: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    DEPRECATED: 'bg-gray-100 text-gray-500 dark:bg-gray-800/30 dark:text-gray-400',
  };
  const labels: Record<TestCaseStatus, string> = {
    DRAFT: 'Draft',
    ACTIVE: 'Active',
    DEPRECATED: 'Deprecated',
  };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', styles[status])}>
      {labels[status]}
    </span>
  );
}

// ─── Filter fns ──────────────────────────────────────────────────────────────

export const statusFilterFn = (
  row: { getValue: (id: string) => unknown },
  columnId: string,
  filterValue: string[],
) => {
  if (!filterValue || filterValue.length === 0) return true;
  return filterValue.includes(row.getValue(columnId) as string);
};

export const priorityFilterFn = (
  row: { getValue: (id: string) => unknown },
  columnId: string,
  filterValue: string[],
) => {
  if (!filterValue || filterValue.length === 0) return true;
  const val = row.getValue(columnId) as string | null;
  if (!val) return filterValue.includes('NONE');
  return filterValue.includes(val);
};

// ─── Table ───────────────────────────────────────────────────────────────────

interface TestCasesTableProps {
  testCases: TestCase[];
  projectId: string;
  isLoading?: boolean;
  onEditCase: (tc: TestCase) => void;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  columnFilters: ColumnFiltersState;
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>;
  globalFilter: string;
  onGlobalFilterChange: (val: string) => void;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
}

export function TestCasesTable({
  testCases,
  projectId: _projectId,
  isLoading,
  onEditCase,
  sorting,
  onSortingChange,
  columnFilters,
  onColumnFiltersChange,
  globalFilter,
  onGlobalFilterChange,
  rowSelection,
  onRowSelectionChange,
}: TestCasesTableProps) {
  const { projectPrefix } = useParams<{ projectPrefix: string }>();
  const columns = useMemo<ColumnDef<TestCase>[]>(
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
        accessorKey: 'testCaseKey',
        header: 'ID',
        cell: ({ row }) =>
          row.original.testCaseKey ? (
            <span className="text-xs font-mono text-muted-foreground">{row.original.testCaseKey}</span>
          ) : null,
        size: 100,
        enableSorting: false,
      },
      {
        accessorKey: 'title',
        header: ({ column }) => <SortHeader label="Title" column={column} />,
        cell: ({ row }) => (
          <span className="text-sm font-medium truncate block max-w-[300px]" title={row.original.title}>
            {row.original.title}
          </span>
        ),
        minSize: 200,
      },
      {
        accessorKey: 'priority',
        header: ({ column }) => <SortHeader label="Priority" column={column} />,
        cell: ({ row }) =>
          row.original.priority ? (
            <PriorityBadge priority={row.original.priority} />
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
        size: 100,
        filterFn: priorityFilterFn,
        enableColumnFilter: true,
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <SortHeader label="Status" column={column} />,
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        size: 100,
        filterFn: statusFilterFn,
        enableColumnFilter: true,
      },
      {
        id: 'stepsCount',
        header: 'Steps',
        cell: ({ row }) => (
          <span className="text-xs text-muted-foreground">
            {row.original._count?.steps ?? row.original.steps?.length ?? 0}
          </span>
        ),
        size: 60,
        enableSorting: false,
      },
      {
        accessorKey: 'estimatedMinutes',
        header: ({ column }) => <SortHeader label="Est." column={column} />,
        cell: ({ row }) =>
          row.original.estimatedMinutes ? (
            <span className="text-xs text-muted-foreground">{row.original.estimatedMinutes}m</span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          ),
        size: 70,
      },
      {
        id: 'tags',
        header: 'Tags',
        cell: ({ row }) => {
          const tags = row.original.tags;
          if (!tags || tags.length === 0) return null;
          const shown = tags.slice(0, 2);
          const rest = tags.slice(2);
          return (
            <div className="flex items-center gap-1 flex-nowrap overflow-hidden">
              {shown.map((tag) => (
                <Badge key={tag} variant="secondary" title={tag} className="max-w-[90px]">
                  <span className="truncate">{tag}</span>
                </Badge>
              ))}
              {rest.length > 0 && (
                <Badge variant="outline" title={rest.join(', ')}>
                  +{rest.length}
                </Badge>
              )}
            </div>
          );
        },
        size: 140,
        enableSorting: false,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: testCases,
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
      <div className="max-h-[70vh] overflow-y-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
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
                No matching test cases
              </TableCell>
            </TableRow>
          ) : (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className="h-10 cursor-pointer hover:bg-muted/50 transition-colors duration-100"
                onClick={() => {
                  const key = row.original.testCaseKey;
                  if (key && projectPrefix) {
                    window.open(`/projects/${projectPrefix}/test-cases/${key}`, '_blank');
                  } else {
                    onEditCase(row.original);
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
    </div>
  );
}
