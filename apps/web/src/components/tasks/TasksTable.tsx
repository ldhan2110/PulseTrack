import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { TaskFilters, statusFilterFn, assigneeFilterFn, sprintFilterFn } from './TaskFilters';
import { useUpdateTaskStatus } from '@/hooks/useTasks';
import type { Task, TaskStatus, Member, Sprint } from '@/lib/types';

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'BACKLOG', label: 'Backlog' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'IN_REVIEW', label: 'In Review' },
  { value: 'DONE', label: 'Done' },
  { value: 'BLOCKED', label: 'Blocked' },
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
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

interface TasksTableProps {
  tasks: Task[];
  projectId: string;
  members: Member[];
  sprints: Sprint[];
  isLoading?: boolean;
  onRowSelectionChange?: (selected: Task[]) => void;
}

export function TasksTable({
  tasks,
  projectId,
  members,
  sprints,
  isLoading,
  onRowSelectionChange,
}: TasksTableProps) {
  const navigate = useNavigate();
  const updateTaskStatus = useUpdateTaskStatus(projectId);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});

  const sprintMap = useMemo(() => {
    const m: Record<string, string> = {};
    sprints.forEach((s) => {
      m[s.id] = s.name;
    });
    return m;
  }, [sprints]);

  const columns = useMemo<ColumnDef<Task>[]>(
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
        accessorKey: 'title',
        header: ({ column }) => <SortHeader label="Title" column={column} />,
        cell: ({ row }) => (
          <span className="text-sm font-medium truncate block max-w-[400px]" title={row.original.title}>
            {row.original.title}
          </span>
        ),
        minSize: 200,
        enableColumnFilter: true,
      },
      {
        accessorKey: 'status',
        header: ({ column }) => <SortHeader label="Status" column={column} />,
        cell: ({ row }) => {
          const task = row.original;
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <Select
                value={task.status}
                onValueChange={(val) => {
                  updateTaskStatus.mutate({ taskId: task.id, status: val as TaskStatus });
                }}
              >
                <SelectTrigger className="h-7 border-transparent bg-transparent shadow-none p-0 focus:ring-0 w-auto gap-1">
                  <SelectValue>
                    <StatusBadge status={task.status} />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <StatusBadge status={opt.value} />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        },
        size: 120,
        filterFn: statusFilterFn,
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
                <AvatarFallback className="text-[10px]">{getInitials(assignee.name)}</AvatarFallback>
              </Avatar>
              <span className="text-sm truncate">{assignee.name}</span>
            </div>
          );
        },
        size: 140,
        filterFn: assigneeFilterFn,
        enableColumnFilter: true,
      },
      {
        accessorKey: 'storyPoints',
        header: ({ column }) => <SortHeader label="Points" column={column} />,
        cell: ({ row }) => (
          <span className="text-sm text-center block">
            {row.original.storyPoints ?? <span className="text-muted-foreground">—</span>}
          </span>
        ),
        size: 80,
      },
      {
        accessorKey: 'sprintId',
        header: ({ column }) => <SortHeader label="Sprint" column={column} />,
        cell: ({ row }) => {
          const sprintId = row.original.sprintId;
          return (
            <span className="text-sm">
              {sprintId ? (sprintMap[sprintId] ?? 'Unknown') : (
                <span className="text-muted-foreground">Backlog</span>
              )}
            </span>
          );
        },
        size: 120,
        filterFn: sprintFilterFn,
        enableColumnFilter: true,
      },
    ],
    [sprintMap, updateTaskStatus],
  );

  const table = useReactTable({
    data: tasks,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      rowSelection,
    },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: (updater) => {
      setRowSelection((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (onRowSelectionChange) {
          const selectedTasks = tasks.filter((_, idx) => next[idx]);
          onRowSelectionChange(selectedTasks);
        }
        return next;
      });
    },
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

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);

  return (
    <div className="flex flex-col gap-3">
      <TaskFilters
        table={table}
        members={members}
        sprints={sprints}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
      />

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
                  No matching tasks
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={cn(
                    'h-10 cursor-pointer hover:bg-muted/50 transition-colors duration-100',
                    row.getIsSelected() && 'bg-muted/30',
                  )}
                  onClick={() => navigate(`/projects/${projectId}/tasks/${row.original.id}`)}
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

      {/* Bulk action bar */}
      {selectedRows.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <BulkActionBar
            count={selectedRows.length}
            sprints={sprints}
            onMoveToSprint={(sprintId) => {
              // Handled by parent
            }}
            onClear={() => table.resetRowSelection()}
          />
        </div>
      )}
    </div>
  );
}

interface BulkActionBarProps {
  count: number;
  sprints: Sprint[];
  onMoveToSprint: (sprintId: string | null) => void;
  onClear: () => void;
}

function BulkActionBar({ count, sprints, onMoveToSprint, onClear }: BulkActionBarProps) {
  return (
    <div className="flex items-center gap-3 bg-card shadow-lg rounded-lg px-4 py-3 border">
      <span className="text-sm font-medium">{count} task{count !== 1 ? 's' : ''} selected</span>
      <Select onValueChange={(val) => onMoveToSprint(val === 'backlog' ? null : val)}>
        <SelectTrigger className="h-8 w-[160px]">
          <SelectValue placeholder="Move to Sprint" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="backlog">Backlog (no sprint)</SelectItem>
          {sprints.map((sprint) => (
            <SelectItem key={sprint.id} value={sprint.id}>
              {sprint.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button variant="ghost" size="sm" onClick={onClear} className="h-8">
        Clear
      </Button>
    </div>
  );
}
