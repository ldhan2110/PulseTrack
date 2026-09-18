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
  ChevronUp,
  ChevronDown,
  Minus,
  type LucideIcon,
} from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Task, Priority } from '@/lib/types';

interface KanbanCardProps {
  task: Task;
  projectId: string;
  projectPrefix: string;
}

const PRIORITY_CONFIG: Record<Priority, { color: string; glow: string; label: string; icon: LucideIcon }> = {
  LOW:      { color: '#6b7280', glow: 'shadow-gray-400/50',   label: 'Low',      icon: ChevronDown },
  MEDIUM:   { color: '#3b82f6', glow: 'shadow-blue-400/50',   label: 'Medium',   icon: Minus },
  HIGH:     { color: '#f59e0b', glow: 'shadow-amber-400/50',  label: 'High',     icon: ChevronUp },
  CRITICAL: { color: '#ef4444', glow: 'shadow-red-400/50',    label: 'Critical', icon: ChevronUp },
  BLOCKER:  { color: '#7c3aed', glow: 'shadow-violet-400/50', label: 'Blocker',  icon: ChevronUp },
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
  const PriorityIcon = priority?.icon;

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
          'relative py-2 overflow-visible transition-all duration-150',
          'hover:shadow-md hover:border-border',
          isDragging && '-translate-y-1 scale-105 shadow-lg',
          overdue && 'border-t-2 border-t-red-500',
        )}
      >
        <CardContent className="px-3 py-2 flex flex-col gap-1.5">
          {/* Zone 1: type icon + key */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span
              className="flex items-center justify-center rounded p-1 shrink-0"
              style={{ backgroundColor: `${typeVisual.color}1a` }}
              title={task.taskType?.name ?? 'Task'}
            >
              <TypeIcon className="size-3" style={{ color: typeVisual.color }} />
            </span>
            {task.taskKey && (
              <span className="text-xs font-mono text-muted-foreground truncate">{task.taskKey}</span>
            )}
          </div>

          {/* Zone 2: title */}
          <p className="text-sm font-medium leading-snug line-clamp-2 break-words min-w-0 group-hover:text-primary transition-colors">
            {task.title}
          </p>

          {/* Zone 3: footer — avatar · type label · date · priority icon */}
          <div className="flex items-center gap-1.5 flex-wrap">
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

            <Badge
              variant="secondary"
              className="gap-1 px-1.5 py-0 text-[11px] font-semibold border-0"
              style={{ backgroundColor: `${typeVisual.color}1a`, color: typeVisual.color }}
            >
              <span className="inline-block size-1.5 rounded-full" style={{ backgroundColor: typeVisual.color }} />
              {task.taskType?.name ?? 'Task'}
            </Badge>

            {task.plannedEndDate && (
              <div className={cn('flex items-center gap-1', overdue ? 'text-destructive' : 'text-muted-foreground')}>
                <Calendar className="size-2.5" />
                <span className="text-[11px]">{formatDate(task.plannedEndDate)}</span>
              </div>
            )}

            {priority && PriorityIcon && (
              <span className="ml-auto shrink-0" title={priority.label}>
                <PriorityIcon className="size-3.5" style={{ color: priority.color }} strokeWidth={2.5} />
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
