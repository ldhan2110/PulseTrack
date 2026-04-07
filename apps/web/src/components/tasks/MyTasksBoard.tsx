import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useDroppable, useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useUpdateMyTaskStatus } from '@/hooks/useMyTasks';
import type { Task, TaskStatus, Priority } from '@/lib/types';

// ─── Column Definitions ────────────────────────────────────────────────────────

type MyTaskColumn = 'BACKLOG' | 'IN_PROGRESS' | 'DONE';

const COLUMNS: { id: MyTaskColumn; label: string; color: string; statuses: TaskStatus[] }[] = [
  { id: 'BACKLOG', label: 'Backlog', color: '#6b7280', statuses: ['BACKLOG'] },
  { id: 'IN_PROGRESS', label: 'In Progress', color: '#3b82f6', statuses: ['IN_PROGRESS', 'IN_REVIEW', 'BLOCKED'] },
  { id: 'DONE', label: 'Done', color: '#22c55e', statuses: ['DONE'] },
];

const COLUMN_DROP_STATUS: Record<MyTaskColumn, TaskStatus> = {
  BACKLOG: 'BACKLOG',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
};

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

// ─── Helpers ───────────────────────────────────────────────────────────────────

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const aDate = a.plannedEndDate ? new Date(a.plannedEndDate).getTime() : Infinity;
    const bDate = b.plannedEndDate ? new Date(b.plannedEndDate).getTime() : Infinity;
    if (aDate !== bDate) return aDate - bDate;
    const aPri = a.priority ? PRIORITY_ORDER[a.priority] : -1;
    const bPri = b.priority ? PRIORITY_ORDER[b.priority] : -1;
    return bPri - aPri;
  });
}

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), 'MMM d');
  } catch {
    return '';
  }
}

function isOverdue(plannedEndDate: string | null | undefined, status: string): boolean {
  if (!plannedEndDate || status === 'DONE') return false;
  return new Date(plannedEndDate) < new Date();
}

// ─── Project Badge ─────────────────────────────────────────────────────────────

const PROJECT_COLORS = ['#2563eb', '#7c3aed', '#059669', '#dc2626', '#d97706', '#0891b2', '#4f46e5'];

function getProjectColor(projectId: string): string {
  let hash = 0;
  for (let i = 0; i < projectId.length; i++) {
    hash = (hash * 31 + projectId.charCodeAt(i)) | 0;
  }
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

// ─── MyTaskCard ────────────────────────────────────────────────────────────────

function MyTaskCard({ task }: { task: Task }) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined;

  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging) {
      const prefix = task.project?.prefix ?? task.projectId;
      navigate(`/projects/${prefix}/tasks/${task.taskKey ?? task.id}`);
    }
    e.stopPropagation();
  };

  const overdue = isOverdue(task.plannedEndDate, task.status);
  const priority = task.priority ? PRIORITY_CONFIG[task.priority] : null;
  const projectColor = getProjectColor(task.projectId);
  const isDone = task.status === 'DONE';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={cn(
        'cursor-grab active:cursor-grabbing touch-none',
        isDragging && 'opacity-50',
      )}
    >
      <Card
        className={cn(
          'min-h-[80px] transition-all duration-150 overflow-hidden',
          isDragging && '-translate-y-1 scale-105 shadow-lg',
          overdue && 'shadow-md',
          isDone && 'opacity-50',
        )}
      >
        {overdue && (
          <div className="h-[3px] w-full bg-gradient-to-r from-red-500 via-red-400 to-red-500" />
        )}
        <CardContent className="p-3 flex flex-col gap-2">
          {/* Top row: task key + project badge */}
          <div className="flex items-center gap-2">
            {task.taskKey && (
              <span className="text-xs font-mono text-muted-foreground">{task.taskKey}</span>
            )}
            {task.project?.prefix && (
              <div
                className="flex items-center justify-center rounded text-[9px] font-semibold text-white px-1 h-4"
                style={{ backgroundColor: projectColor }}
              >
                {task.project.prefix}
              </div>
            )}
            <div className="ml-auto">
              {priority && (
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className="inline-block size-2 rounded-full shadow-sm"
                    style={{ backgroundColor: priority.color, boxShadow: `0 0 4px ${priority.color}` }}
                  />
                  <span className="text-[11px] font-medium" style={{ color: priority.color }}>
                    {priority.label}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Title */}
          <p className={cn('text-sm font-medium line-clamp-2', isDone && 'line-through')}>
            {task.title}
          </p>

          {/* Footer: due date */}
          {task.plannedEndDate && (
            <div className="flex items-center justify-end border-t border-border/40 pt-2 mt-auto">
              <div className={cn('flex items-center gap-1', overdue ? 'text-destructive' : 'text-amber-500')}>
                <Calendar className="size-2.5" />
                <span className="text-[11px]">{formatDate(task.plannedEndDate)}</span>
                {overdue && (
                  <span className="text-[9px] bg-destructive/20 text-destructive px-1 rounded">OVERDUE</span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── MyTaskColumn ──────────────────────────────────────────────────────────────

function MyTaskColumn({ column, tasks }: { column: typeof COLUMNS[number]; tasks: Task[] }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <div className="size-2 rounded-full" style={{ backgroundColor: column.color }} />
        <h3 className="text-[13px] font-semibold">{column.label}</h3>
        <Badge variant="secondary" className="text-xs px-1.5 py-0 h-5">
          {tasks.length}
        </Badge>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          'flex flex-col flex-1 rounded-lg p-2 min-h-[200px] transition-colors duration-100',
          isOver ? 'bg-muted' : 'bg-muted/30',
        )}
      >
        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col gap-2 pr-2">
            {tasks.map((task) => (
              <MyTaskCard key={task.id} task={task} />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

// ─── MyTasksBoard ──────────────────────────────────────────────────────────────

interface MyTasksBoardProps {
  tasks: Task[];
}

export function MyTasksBoard({ tasks }: MyTasksBoardProps) {
  const updateStatus = useUpdateMyTaskStatus();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const tasksByColumn = COLUMNS.reduce<Record<MyTaskColumn, Task[]>>(
    (acc, col) => {
      acc[col.id] = sortTasks(tasks.filter((t) => col.statuses.includes(t.status)));
      return acc;
    },
    { BACKLOG: [], IN_PROGRESS: [], DONE: [] },
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const columnId = over.id as MyTaskColumn;
    if (!COLUMN_DROP_STATUS[columnId]) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    const newStatus = COLUMN_DROP_STATUS[columnId];
    const currentColumn = COLUMNS.find((c) => c.statuses.includes(task.status));
    if (currentColumn?.id === columnId) return;

    updateStatus.mutate({ task, status: newStatus });
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-hidden h-full pb-4">
        {COLUMNS.map((col) => (
          <MyTaskColumn key={col.id} column={col} tasks={tasksByColumn[col.id]} />
        ))}
      </div>
    </DndContext>
  );
}
