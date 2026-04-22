import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, ChevronDown, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StatusBadge } from './StatusBadge';
import { TaskProgressBar } from './TaskProgressBar';
import { getParentProgress } from './task-progress-utils';
import { TaskFilters, statusFilterFn, assigneeFilterFn, sprintFilterFn, progressFilterFn, matchesFilters } from './TaskFilters';
import { useUpdateTaskStatus } from '@/hooks/useTasks';
import { formatMinutes } from '@/lib/time-utils';
import { format } from 'date-fns';
import type { Task, Member, Sprint, Priority, WorkflowStatus } from '@/lib/types';

type ProcessedTask = Task & { _promotedFromParent?: Task };

const PRIORITY_CONFIG: Record<Priority, { color: string; label: string }> = {
  LOW:      { color: '#6b7280', label: 'Low' },
  MEDIUM:   { color: '#3b82f6', label: 'Medium' },
  HIGH:     { color: '#f59e0b', label: 'High' },
  CRITICAL: { color: '#ef4444', label: 'Critical' },
  BLOCKER:  { color: '#7c3aed', label: 'Blocker' },
};

const PRIORITY_ORDER: Record<Priority, number> = {
  LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3, BLOCKER: 4,
};

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
  projectPrefix: string;
  members: Member[];
  sprints: Sprint[];
  workflowStatuses?: WorkflowStatus[];
  initialFilters?: ColumnFiltersState;
  initialGlobalFilter?: string;
  isLoading?: boolean;
  onRowSelectionChange?: (selected: Task[]) => void;
  onFiltersChange?: (filters: ColumnFiltersState, globalFilter: string) => void;
}

export function TasksTable({
  tasks,
  projectId,
  projectPrefix,
  members,
  sprints,
  workflowStatuses,
  initialFilters,
  initialGlobalFilter,
  isLoading,
  onRowSelectionChange,
  onFiltersChange,
}: TasksTableProps) {
  const updateTaskStatus = useUpdateTaskStatus(projectId);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>(initialFilters ?? []);
  const [globalFilter, setGlobalFilter] = useState(initialGlobalFilter ?? '');
  const [rowSelection, setRowSelection] = useState<Record<string, boolean>>({});
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (initialFilters) {
      setColumnFilters(initialFilters);
    }
    setGlobalFilter(initialGlobalFilter ?? '');
  }, [initialFilters, initialGlobalFilter]);

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    onFiltersChange?.(columnFilters, globalFilter);
  }, [columnFilters, globalFilter, onFiltersChange]);

  const toggleExpand = (taskId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const hasActiveFilters = columnFilters.length > 0 || globalFilter !== '';

  const processedTasks = useMemo(() => {
    if (!hasActiveFilters) return tasks;

    const result: ProcessedTask[] = [];
    for (const parent of tasks) {
      const parentMatches = matchesFilters(parent, columnFilters, globalFilter);
      const matchingChildren = (parent.children ?? []).filter((child) =>
        matchesFilters(child, columnFilters, globalFilter),
      );

      if (parentMatches) {
        result.push({
          ...parent,
          children: matchingChildren,
        });
      } else if (matchingChildren.length > 0) {
        for (const child of matchingChildren) {
          result.push({
            ...child,
            _promotedFromParent: parent,
          });
        }
      }
    }
    return result;
  }, [tasks, columnFilters, globalFilter, hasActiveFilters]);

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
        id: 'expand',
        header: () => null,
        cell: ({ row }: { row: { original: Task } }) => {
          const task = row.original as ProcessedTask;
          if (task._promotedFromParent) return null;
          const hasChildren = (task.children?.length ?? 0) > 0;
          if (!hasChildren) return null;
          const isExpanded = expandedRows.has(task.id);
          return (
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpand(task.id); }}
              className="p-1 hover:bg-muted rounded"
            >
              {isExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            </button>
          );
        },
        enableSorting: false,
        enableColumnFilter: false,
        size: 32,
      },
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
        cell: ({ row }) => {
          const task = row.original as ProcessedTask;
          const promoted = task._promotedFromParent;
          const hasChildren = !promoted && (task.children?.length ?? 0) > 0;
          return (
            <span className={cn('text-sm truncate block max-w-[400px]', hasChildren ? 'font-semibold' : 'font-medium')} title={task.title}>
              {promoted && promoted.taskKey && (
                <span className="font-mono text-xs text-muted-foreground/60 mr-1">{promoted.taskKey} &gt; </span>
              )}
              {task.taskKey && (
                <span className="font-mono text-xs text-muted-foreground mr-2">{task.taskKey}</span>
              )}
              {task.title}
            </span>
          );
        },
        minSize: 200,
        enableColumnFilter: true,
      },
      {
        accessorKey: 'workflowStatusId',
        header: ({ column }) => <SortHeader label="Status" column={column} />,
        cell: ({ row }) => {
          const task = row.original;
          return (
            <div onClick={(e) => e.stopPropagation()}>
              <StatusBadge status={task.workflowStatus ?? null} />
            </div>
          );
        },
        size: 120,
        filterFn: statusFilterFn,
        enableColumnFilter: true,
      },
      {
        accessorKey: 'priority',
        header: ({ column }) => <SortHeader label="Priority" column={column} />,
        cell: ({ row }) => {
          const p = row.original.priority as Priority | null | undefined;
          if (!p) return <span className="text-xs text-muted-foreground">—</span>;
          const cfg = PRIORITY_CONFIG[p];
          return (
            <div className="flex items-center gap-1.5">
              <span
                className="inline-block size-2 rounded-full"
                style={{ backgroundColor: cfg.color }}
              />
              <span className="text-xs font-medium" style={{ color: cfg.color }}>
                {cfg.label}
              </span>
            </div>
          );
        },
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.priority;
          const b = rowB.original.priority;
          const aOrder = a ? PRIORITY_ORDER[a] : -1;
          const bOrder = b ? PRIORITY_ORDER[b] : -1;
          return aOrder - bOrder;
        },
        enableSorting: true,
        size: 100,
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
      {
        accessorKey: 'plannedEndDate',
        header: ({ column }) => <SortHeader label="Due" column={column} />,
        cell: ({ row }) => {
          const due = row.original.plannedEndDate;
          if (!due) return <span className="text-xs text-muted-foreground">—</span>;
          const isOverdue = new Date(due) < new Date() && !row.original.workflowStatus?.isClosed;
          let formatted: string;
          try {
            formatted = format(new Date(due), 'MMM d, yyyy');
          } catch {
            return <span className="text-xs text-muted-foreground">—</span>;
          }
          return (
            <span className={cn('text-xs', isOverdue ? 'text-destructive' : 'text-amber-500')}>
              {formatted}
            </span>
          );
        },
        sortingFn: (rowA, rowB) => {
          const a = rowA.original.plannedEndDate;
          const b = rowB.original.plannedEndDate;
          if (!a && !b) return 0;
          if (!a) return 1;
          if (!b) return -1;
          return new Date(a).getTime() - new Date(b).getTime();
        },
        enableSorting: true,
        size: 110,
      },
      {
        id: 'estimated',
        header: 'Est.',
        accessorFn: (row: Task) => {
          if ((row.children?.length ?? 0) > 0) {
            return row.children!.reduce((sum, c) => sum + (c.estimatedMinutes ?? 0), 0);
          }
          return row.estimatedMinutes ?? 0;
        },
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const val = getValue() as number;
          return <span className="text-xs">{val > 0 ? formatMinutes(val) : '—'}</span>;
        },
        size: 70,
      },
      {
        id: 'progress',
        header: ({ column }) => <SortHeader label="Progress" column={column} />,
        accessorFn: (row: Task) => {
          if ((row.children?.length ?? 0) > 0) {
            return getParentProgress(row.children ?? []);
          }
          return row.progress ?? 0;
        },
        cell: ({ getValue }: { getValue: () => unknown }) => {
          const val = getValue() as number;
          return <TaskProgressBar value={val} size="sm" showLabel editable={false} />;
        },
        filterFn: progressFilterFn,
        enableColumnFilter: true,
        size: 120,
      },
      {
        id: 'logged',
        header: 'Logged',
        accessorFn: (row: Task) => {
          if ((row.children?.length ?? 0) > 0) {
            return row.children!.reduce((sum, c) => {
              return sum + (c.timeLogs?.reduce((s, tl) => s + tl.minutes, 0) ?? 0);
            }, 0);
          }
          return row.timeLogs?.reduce((s, tl) => s + tl.minutes, 0) ?? 0;
        },
        cell: ({ getValue, row }: { getValue: () => unknown; row: { original: Task } }) => {
          const logged = getValue() as number;
          const task = row.original;
          const estimated = (task.children?.length ?? 0) > 0
            ? task.children!.reduce((sum, c) => sum + (c.estimatedMinutes ?? 0), 0)
            : (task.estimatedMinutes ?? 0);
          const isOverBudget = estimated > 0 && logged > estimated;
          return (
            <span className={cn('text-xs', isOverBudget && 'text-red-500 font-semibold')}>
              {logged > 0 ? formatMinutes(logged) : '—'}
              {isOverBudget && ' ⚠️'}
            </span>
          );
        },
        size: 80,
      },
    ],
    [sprintMap, updateTaskStatus, expandedRows],
  );

  const table = useReactTable({
    data: processedTasks,
    columns,
    state: {
      sorting,
      columnFilters,
      rowSelection,
    },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: (updater) => {
      setRowSelection((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (onRowSelectionChange) {
          const selectedTasks = processedTasks.filter((_, idx) => next[idx]);
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

  return (
    <div className="flex flex-col gap-3">
      <TaskFilters
        table={table}
        members={members}
        sprints={sprints}
        workflowStatuses={workflowStatuses}
        globalFilter={globalFilter}
        onGlobalFilterChange={setGlobalFilter}
      />

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
                  No matching tasks
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <React.Fragment key={row.id}>
                  <TableRow
                    data-state={row.getIsSelected() && 'selected'}
                    className={cn(
                      'h-10 cursor-pointer hover:bg-muted/50 transition-colors duration-100',
                      row.getIsSelected() && 'bg-muted/30',
                    )}
                    onClick={() => window.open(`/projects/${projectPrefix}/tasks/${row.original.taskKey ?? row.original.id}`, '_blank')}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id} className="py-0">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                  {expandedRows.has(row.original.id) && row.original.children?.map((child) => (
                    <TableRow
                      key={child.id}
                      className="h-9 bg-muted/30 cursor-pointer hover:bg-muted/50"
                      onClick={() => window.open(`/projects/${projectPrefix}/tasks/${child.taskKey ?? child.id}`, '_blank')}
                    >
                      <TableCell />
                      <TableCell />
                      <TableCell>
                        <div className="flex items-center gap-2 pl-4 min-w-0 overflow-hidden">
                          <span className="text-muted-foreground shrink-0">└</span>
                          <span className="text-xs text-muted-foreground font-mono shrink-0">{child.taskKey}</span>
                          <span className="text-sm truncate max-w-[250px]" title={child.title}>{child.title}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {child.workflowStatus && <StatusBadge status={child.workflowStatus} />}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const p = child.priority as Priority | null | undefined;
                          if (!p) return <span className="text-xs text-muted-foreground">—</span>;
                          const cfg = PRIORITY_CONFIG[p];
                          return (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-block size-2 rounded-full" style={{ backgroundColor: cfg.color }} />
                              <span className="text-xs font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {child.assignee ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="size-6">
                              {child.assignee.imageUrl && <AvatarImage src={child.assignee.imageUrl} alt={child.assignee.name ?? child.assignee.username} />}
                              <AvatarFallback className="text-[10px]">{getInitials(child.assignee.name ?? child.assignee.username)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm truncate">{child.assignee.name ?? child.assignee.username}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-center block">
                          {child.storyPoints ?? <span className="text-muted-foreground">—</span>}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {child.sprintId ? (sprintMap[child.sprintId] ?? 'Unknown') : (
                            <span className="text-muted-foreground">Backlog</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const due = child.plannedEndDate;
                          if (!due) return <span className="text-xs text-muted-foreground">—</span>;
                          const isOverdue = new Date(due) < new Date() && !child.workflowStatus?.isClosed;
                          try {
                            const formatted = format(new Date(due), 'MMM d, yyyy');
                            return (
                              <span className={cn('text-xs', isOverdue ? 'text-destructive' : 'text-amber-500')}>
                                {formatted}
                              </span>
                            );
                          } catch {
                            return <span className="text-xs text-muted-foreground">—</span>;
                          }
                        })()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {child.estimatedMinutes ? formatMinutes(child.estimatedMinutes) : '—'}
                      </TableCell>
                      <TableCell>
                        <TaskProgressBar value={child.progress ?? 0} size="sm" showLabel editable={false} />
                      </TableCell>
                      <TableCell className="text-xs">
                        {(() => {
                          const logged = child.timeLogs?.reduce((s, tl) => s + tl.minutes, 0) ?? 0;
                          const isOver = (child.estimatedMinutes ?? 0) > 0 && logged > (child.estimatedMinutes ?? 0);
                          return logged > 0 ? (
                            <span className={isOver ? 'text-red-500 font-semibold' : ''}>
                              {formatMinutes(logged)}{isOver && ' ⚠️'}
                            </span>
                          ) : '—';
                        })()}
                      </TableCell>
                    </TableRow>
                  ))}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

    </div>
  );
}

// Exported for use in BacklogPage bulk action bar
interface BulkActionBarProps {
  count: number;
  sprints: Sprint[];
  onMoveToSprint: (sprintId: string | null) => void;
  onDelete?: () => void;
  onClear: () => void;
}

export function BulkActionBar({ count, sprints, onMoveToSprint, onDelete, onClear }: BulkActionBarProps) {
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
      {onDelete && (
        <Button variant="destructive" size="sm" onClick={onDelete} className="h-8 gap-1.5">
          <Trash2 className="size-3.5" />
          Delete
        </Button>
      )}
      <Button variant="ghost" size="sm" onClick={onClear} className="h-8">
        Clear
      </Button>
    </div>
  );
}
