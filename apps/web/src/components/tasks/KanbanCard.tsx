import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Bug,
  Bookmark,
  CheckSquare,
  Zap,
  GitBranch,
  ArrowUp,
  Sparkles,
  ListTree,
  Clock,
  type LucideIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Task, Priority } from '@/lib/types';
import { TaskProgressBar } from './TaskProgressBar';
import { getParentProgress } from './task-progress-utils';

interface KanbanCardProps {
  task: Task;
  projectId: string;
  projectPrefix: string;
}

const PRIORITY_CONFIG: Record<Priority, { color: string; glow: string; label: string }> = {
  LOW:      { color: '#6b7280', glow: 'shadow-gray-400/50',   label: 'Low' },
  MEDIUM:   { color: '#3b82f6', glow: 'shadow-blue-400/50',   label: 'Medium' },
  HIGH:     { color: '#f59e0b', glow: 'shadow-amber-400/50',  label: 'High' },
  CRITICAL: { color: '#ef4444', glow: 'shadow-red-400/50',    label: 'Critical' },
  BLOCKER:  { color: '#7c3aed', glow: 'shadow-violet-400/50', label: 'Blocker' },
};

// ponytail: type icon/color derived from the type NAME client-side — no schema column.
// Add a real ProjectTaskType.color column only when per-type custom colors are requested.
const TYPE_ICONS: Array<{ match: RegExp; icon: LucideIcon; color: string }> = [
  { match: /bug|defect/i,          icon: Bug,         color: '#ef4444' },
  { match: /story/i,               icon: Bookmark,    color: '#22c55e' },
  { match: /epic/i,                icon: Zap,         color: '#8b5cf6' },
  { match: /sub.?task/i,           icon: ListTree,    color: '#0ea5e9' },
  { match: /improv|enhanc/i,       icon: ArrowUp,     color: '#14b8a6' },
  { match: /feature/i,             icon: Sparkles,    color: '#f59e0b' },
  { match: /spike|research/i,      icon: GitBranch,   color: '#a855f7' },
];
const DEFAULT_TYPE = { icon: CheckSquare, color: '#3b82f6' };

function getTypeVisual(name: string | null | undefined) {
  if (!name) return DEFAULT_TYPE;
  return TYPE_ICONS.find((t) => t.match.test(name)) ?? DEFAULT_TYPE;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), 'MMM d');
  } catch {
    return '';
  }
}

function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function isOverdue(plannedEndDate: string | null | undefined, isClosed: boolean | undefined): boolean {
  if (!plannedEndDate || isClosed) return false;
  return new Date(plannedEndDate) < new Date();
}

export function KanbanCard({ task, projectId: _projectId, projectPrefix }: KanbanCardProps) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const handleClick = (e: React.MouseEvent) => {
    if (!isDragging) {
      navigate(`/projects/${projectPrefix}/tasks/${task.taskKey ?? task.id}`);
    }
    e.stopPropagation();
  };

  const overdue = isOverdue(task.plannedEndDate, task.workflowStatus?.isClosed);
  const priority = task.priority ? PRIORITY_CONFIG[task.priority] : null;
  const typeVisual = getTypeVisual(task.taskType?.name);
  const TypeIcon = typeVisual.icon;
  const railColor = priority?.color ?? typeVisual.color;
  const loggedMinutes = (task.timeLogs ?? []).reduce((sum, l) => sum + l.minutes, 0);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={cn(
        'cursor-grab active:cursor-grabbing touch-none group',
        isDragging && 'opacity-50',
      )}
    >
      <Card
        className={cn(
          'relative min-h-[80px] transition-all duration-150 overflow-hidden',
          'hover:shadow-md hover:border-border',
          isDragging && '-translate-y-1 scale-105 shadow-lg',
          overdue && 'shadow-md',
        )}
      >
        {/* Left priority/type rail */}
        <div
          className="absolute left-0 top-0 h-full w-1"
          style={{ backgroundColor: railColor }}
        />

        {/* Overdue red gradient strip */}
        {overdue && (
          <div className="h-[3px] w-full bg-gradient-to-r from-red-500 via-red-400 to-red-500" />
        )}

        <CardContent className="p-3 pl-4 flex flex-col gap-2">
          {/* Top row: type icon + key + priority */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span
                className="flex items-center gap-1 rounded px-1 py-0.5 shrink-0"
                style={{ backgroundColor: `${typeVisual.color}1a` }}
                title={task.taskType?.name ?? 'Task'}
              >
                <TypeIcon className="size-3" style={{ color: typeVisual.color }} />
                {task.taskType?.name && (
                  <span className="text-[10px] font-semibold" style={{ color: typeVisual.color }}>
                    {task.taskType.name}
                  </span>
                )}
              </span>
              {task.taskKey && (
                <span className="text-xs font-mono text-muted-foreground truncate">{task.taskKey}</span>
              )}
            </div>
            {priority && (
              <div
                className="flex items-center gap-1 shrink-0 rounded-full px-1.5 py-0.5"
                style={{ backgroundColor: `${priority.color}1a` }}
              >
                <span
                  className="inline-block size-1.5 rounded-full"
                  style={{ backgroundColor: priority.color }}
                />
                <span className="text-[10px] font-semibold" style={{ color: priority.color }}>
                  {priority.label}
                </span>
              </div>
            )}
          </div>

          {/* Title */}
          <p className="text-sm font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
            {task.title}
          </p>

          {/* Meta row: subtasks + time */}
          {((task.children?.length ?? 0) > 0 || task.estimatedMinutes != null || loggedMinutes > 0) && (
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              {(task.children?.length ?? 0) > 0 && (
                <span className="flex items-center gap-1" title="Subtasks">
                  <ListTree className="size-3" />
                  {task.children!.length}
                </span>
              )}
              {(task.estimatedMinutes != null || loggedMinutes > 0) && (
                <span className="flex items-center gap-1" title="Logged / estimated">
                  <Clock className="size-3" />
                  {loggedMinutes > 0 ? formatMinutes(loggedMinutes) : '0m'}
                  {task.estimatedMinutes != null && ` / ${formatMinutes(task.estimatedMinutes)}`}
                </span>
              )}
            </div>
          )}

          {/* Footer row */}
          <div className="flex items-center justify-between border-t border-border/40 pt-2 mt-auto">
            {/* Left: assignee + story points */}
            <div className="flex items-center gap-1.5">
              {task.assignee ? (
                <Avatar className="size-5">
                  {task.assignee.imageUrl && (
                    <AvatarImage src={task.assignee.imageUrl} alt={task.assignee.name ?? task.assignee.username} />
                  )}
                  <AvatarFallback className="text-[9px]">
                    {getInitials(task.assignee.name ?? task.assignee.username)}
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div className="size-5 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-[9px] text-muted-foreground">?</span>
                </div>
              )}
              {task.storyPoints != null && (
                <Badge variant="secondary" className="text-xs px-1.5 py-0">
                  {task.storyPoints} pts
                </Badge>
              )}
            </div>

            {/* Right: planned end date */}
            {task.plannedEndDate && (
              <div className={cn('flex items-center gap-1', overdue ? 'text-destructive' : 'text-amber-500')}>
                <Calendar className="size-2.5" />
                <span className="text-[11px]">{formatDate(task.plannedEndDate)}</span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <TaskProgressBar
            value={(task.children?.length ?? 0) > 0 ? getParentProgress(task.children ?? []) : (task.progress ?? 0)}
            size="sm"
            showLabel={false}
            editable={false}
          />
        </CardContent>
      </Card>
    </div>
  );
}
