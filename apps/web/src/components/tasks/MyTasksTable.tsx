import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { StatusBadge } from './StatusBadge';
import { useDeleteMyTask } from '@/hooks/useMyTasks';
import { cn } from '@/lib/utils';
import { formatMinutes } from '@/lib/time-utils';
import type { Task, Priority } from '@/lib/types';

// ─── Priority Config ───────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<Priority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
  BLOCKER: 4,
};

const PRIORITY_CONFIG: Record<Priority, { color: string; label: string }> = {
  LOW:      { color: '#6b7280', label: 'Low' },
  MEDIUM:   { color: '#3b82f6', label: 'Medium' },
  HIGH:     { color: '#f59e0b', label: 'High' },
  CRITICAL: { color: '#ef4444', label: 'Critical' },
  BLOCKER:  { color: '#7c3aed', label: 'Blocker' },
};

const ALL_PRIORITIES: Priority[] = ['BLOCKER', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

// ─── Helpers ───────────────────────────────────────────────────────────────────

type SortField = 'taskKey' | 'title' | 'project' | 'status' | 'priority' | 'dueDate';
type SortDir = 'asc' | 'desc';

function isOverdue(plannedEndDate: string | null | undefined, isClosed: boolean): boolean {
  if (!plannedEndDate || isClosed) return false;
  return new Date(plannedEndDate) < new Date();
}

function compareTasks(a: Task, b: Task, field: SortField, dir: SortDir): number {
  let cmp = 0;
  switch (field) {
    case 'taskKey':
      cmp = (a.taskKey ?? '').localeCompare(b.taskKey ?? '');
      break;
    case 'title':
      cmp = a.title.localeCompare(b.title);
      break;
    case 'project':
      cmp = (a.project?.name ?? '').localeCompare(b.project?.name ?? '');
      break;
    case 'status':
      cmp = (a.workflowStatus?.position ?? 0) - (b.workflowStatus?.position ?? 0);
      break;
    case 'priority': {
      const aPri = a.priority ? PRIORITY_ORDER[a.priority] : -1;
      const bPri = b.priority ? PRIORITY_ORDER[b.priority] : -1;
      cmp = aPri - bPri;
      break;
    }
    case 'dueDate': {
      const aDate = a.plannedEndDate ? new Date(a.plannedEndDate).getTime() : Infinity;
      const bDate = b.plannedEndDate ? new Date(b.plannedEndDate).getTime() : Infinity;
      cmp = aDate - bDate;
      break;
    }
  }
  return dir === 'desc' ? -cmp : cmp;
}

// ─── Filter Bar ────────────────────────────────────────────────────────────────

interface FilterBarProps {
  tasks: Task[];
  statusFilter: string[];
  priorityFilter: string[];
  projectFilter: string[];
  onStatusChange: (v: string[]) => void;
  onPriorityChange: (v: string[]) => void;
  onProjectChange: (v: string[]) => void;
  onClear: () => void;
}

function FilterBar({
  tasks,
  statusFilter,
  priorityFilter,
  projectFilter,
  onStatusChange,
  onPriorityChange,
  onProjectChange,
  onClear,
}: FilterBarProps) {
  const statuses = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    for (const t of tasks) {
      if (t.workflowStatus) {
        map.set(t.workflowStatus.id, {
          id: t.workflowStatus.id,
          name: t.workflowStatus.name,
          color: t.workflowStatus.color,
        });
      }
    }
    return Array.from(map.values());
  }, [tasks]);

  const projects = useMemo(() => {
    const map = new Map<string, { id: string; name: string }>();
    for (const t of tasks) {
      if (t.project) {
        map.set(t.projectId, { id: t.projectId, name: t.project.name });
      }
    }
    return Array.from(map.values());
  }, [tasks]);

  const hasFilters = statusFilter.length > 0 || priorityFilter.length > 0 || projectFilter.length > 0;

  const toggleFilter = (current: string[], value: string, setter: (v: string[]) => void) => {
    setter(current.includes(value) ? current.filter((v) => v !== value) : [...current, value]);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Select value="" onValueChange={(v) => toggleFilter(statusFilter, v, onStatusChange)}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder={statusFilter.length > 0 ? `Status (${statusFilter.length})` : 'Status'} />
        </SelectTrigger>
        <SelectContent>
          {statuses.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: s.color }} />
                {s.name}
                {statusFilter.includes(s.id) && <span className="ml-auto text-primary">&#10003;</span>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value="" onValueChange={(v) => toggleFilter(priorityFilter, v, onPriorityChange)}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder={priorityFilter.length > 0 ? `Priority (${priorityFilter.length})` : 'Priority'} />
        </SelectTrigger>
        <SelectContent>
          {ALL_PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full" style={{ backgroundColor: PRIORITY_CONFIG[p].color }} />
                {PRIORITY_CONFIG[p].label}
                {priorityFilter.includes(p) && <span className="ml-auto text-primary">&#10003;</span>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value="" onValueChange={(v) => toggleFilter(projectFilter, v, onProjectChange)}>
        <SelectTrigger className="w-[140px] h-8 text-xs">
          <SelectValue placeholder={projectFilter.length > 0 ? `Project (${projectFilter.length})` : 'Project'} />
        </SelectTrigger>
        <SelectContent>
          {projects.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              <div className="flex items-center gap-2">
                {p.name}
                {projectFilter.includes(p.id) && <span className="ml-auto text-primary">&#10003;</span>}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClear}>
          <X className="size-3 mr-1" />
          Clear
        </Button>
      )}
    </div>
  );
}

// ─── Sortable Header ───────────────────────────────────────────────────────────

function SortableHeader({
  label,
  field,
  currentField,
  currentDir,
  onSort,
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const isActive = currentField === field;
  return (
    <TableHead
      className="cursor-pointer select-none hover:text-foreground transition-colors text-xs"
      onClick={() => onSort(field)}
    >
      <div className="flex items-center gap-1">
        {label}
        {isActive && (
          <span className="text-[10px]">{currentDir === 'asc' ? '\u25B2' : '\u25BC'}</span>
        )}
      </div>
    </TableHead>
  );
}

// ─── MyTasksTable ──────────────────────────────────────────────────────────────

interface MyTasksTableProps {
  tasks: Task[];
}

export function MyTasksTable({ tasks }: MyTasksTableProps) {
  const navigate = useNavigate();
  const deleteTask = useDeleteMyTask();

  const [sortField, setSortField] = useState<SortField>('dueDate');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<string[]>([]);
  const [projectFilter, setProjectFilter] = useState<string[]>([]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir(field === 'priority' ? 'desc' : 'asc');
    }
  };

  const filteredAndSorted = useMemo(() => {
    let result = tasks;

    if (statusFilter.length > 0) {
      result = result.filter((t) => t.workflowStatus && statusFilter.includes(t.workflowStatus.id));
    }
    if (priorityFilter.length > 0) {
      result = result.filter((t) => t.priority && priorityFilter.includes(t.priority));
    }
    if (projectFilter.length > 0) {
      result = result.filter((t) => projectFilter.includes(t.projectId));
    }

    return [...result].sort((a, b) => {
      const primary = compareTasks(a, b, sortField, sortDir);
      if (primary !== 0) return primary;
      if (sortField === 'dueDate') {
        return compareTasks(a, b, 'priority', 'desc');
      }
      return compareTasks(a, b, 'dueDate', 'asc');
    });
  }, [tasks, statusFilter, priorityFilter, projectFilter, sortField, sortDir]);

  const handleClearFilters = () => {
    setStatusFilter([]);
    setPriorityFilter([]);
    setProjectFilter([]);
  };

  const handleRowClick = (task: Task) => {
    const prefix = task.project?.prefix ?? task.projectId;
    navigate(`/projects/${prefix}/tasks/${task.taskKey ?? task.id}`);
  };

  const toggleSelect = (taskId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filteredAndSorted.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filteredAndSorted.map((t) => t.id)));
    }
  };

  const handleDeleteSelected = () => {
    const tasksToDelete = tasks.filter((t) => selected.has(t.id));
    for (const t of tasksToDelete) {
      deleteTask.mutate({ projectId: t.projectId, taskId: t.id });
    }
    setSelected(new Set());
    setShowDeleteDialog(false);
  };

  return (
    <div className="flex flex-col gap-3">
      <FilterBar
        tasks={tasks}
        statusFilter={statusFilter}
        priorityFilter={priorityFilter}
        projectFilter={projectFilter}
        onStatusChange={setStatusFilter}
        onPriorityChange={setPriorityFilter}
        onProjectChange={setProjectFilter}
        onClear={handleClearFilters}
      />

      {selected.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 rounded-lg border bg-muted/50">
          <span className="text-sm font-medium">
            {selected.size} task{selected.size !== 1 ? 's' : ''} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            className="h-7 gap-1.5"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setSelected(new Set())}
          >
            Clear selection
          </Button>
        </div>
      )}

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} task{selected.size !== 1 ? 's' : ''}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the selected task{selected.size !== 1 ? 's' : ''} and all associated data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDeleteSelected}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={filteredAndSorted.length > 0 && selected.size === filteredAndSorted.length}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <SortableHeader label="Key" field="taskKey" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Title" field="title" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Project" field="project" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Status" field="status" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Priority" field="priority" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Due Date" field="dueDate" currentField={sortField} currentDir={sortDir} onSort={handleSort} />
              <TableHead className="text-xs">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">
                  No tasks match the current filters
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map((task) => {
                const isClosed = task.workflowStatus?.isClosed === true;
                const overdue = isOverdue(task.plannedEndDate, isClosed);
                const priority = task.priority ? PRIORITY_CONFIG[task.priority] : null;
                const logged = task.timeLogs?.reduce((s, tl) => s + tl.minutes, 0) ?? 0;

                return (
                  <TableRow
                    key={task.id}
                    className={cn(
                      'cursor-pointer hover:bg-muted/50 transition-colors',
                      isClosed && 'opacity-50',
                      selected.has(task.id) && 'bg-muted/40',
                    )}
                    onClick={() => handleRowClick(task)}
                  >
                    <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selected.has(task.id)}
                        onCheckedChange={() => toggleSelect(task.id)}
                      />
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {task.taskKey}
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <span className={cn('text-sm font-medium truncate block', isClosed && 'line-through')}>
                        {task.title}
                      </span>
                    </TableCell>
                    <TableCell>
                      {task.project && (
                        <Badge variant="secondary" className="text-[11px] px-1.5 py-0 h-5">
                          {task.project.name}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={task.workflowStatus ?? null} />
                    </TableCell>
                    <TableCell>
                      {priority && (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: priority.color, boxShadow: `0 0 4px ${priority.color}` }}
                          />
                          <span className="text-xs font-medium" style={{ color: priority.color }}>
                            {priority.label}
                          </span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {task.plannedEndDate ? (
                        <div className={cn('flex items-center gap-1 text-xs', overdue ? 'text-destructive' : 'text-muted-foreground')}>
                          <Calendar className="size-3" />
                          {format(new Date(task.plannedEndDate), 'MMM d, yyyy')}
                          {overdue && (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0 h-4 ml-1">
                              OVERDUE
                            </Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {task.estimatedMinutes && task.estimatedMinutes > 0 ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          {formatMinutes(logged)} / {formatMinutes(task.estimatedMinutes)}
                        </div>
                      ) : logged > 0 ? (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="size-3" />
                          {formatMinutes(logged)}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
