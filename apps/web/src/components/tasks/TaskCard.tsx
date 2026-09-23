import type { ReactNode } from 'react';
import {
  Calendar,
  Bug,
  BookOpen,
  Square,
  Flag,
  GitBranch,
  TrendingUp,
  Box,
  FlaskConical,
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
  { match: /bug|defect/i,          icon: Bug,          color: '#ef4444' },
  { match: /story/i,               icon: BookOpen,     color: '#22c55e' },
  { match: /epic/i,                icon: Flag,         color: '#8b5cf6' },
  { match: /sub.?task/i,           icon: GitBranch,    color: '#0ea5e9' },
  { match: /improv|enhanc/i,       icon: TrendingUp,   color: '#14b8a6' },
  { match: /feature/i,             icon: Box,          color: '#f59e0b' },
  { match: /spike|research/i,      icon: FlaskConical, color: '#a855f7' },
];
const DEFAULT_TYPE = { icon: Square, color: '#3b82f6' };

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

export function isOverdue(plannedEndDate: string | null | undefined, isClosed: boolean | undefined): boolean {
  if (!plannedEndDate || isClosed) return false;
  return new Date(plannedEndDate) < new Date();
}

interface TaskCardProps {
  task: Task;
  /** Show a project chip in zone 1 (used by the cross-project My Tasks list). */
  showProject?: boolean;
  /** Show the story-points chip. Off by default so the desktop KanbanCard stays unchanged; mobile surfaces turn it on. */
  showPoints?: boolean;
  /** Control rendered at the top-right of zone 1 — a status chip or a move-status dropdown. */
  statusControl?: ReactNode;
  className?: string;
}

/**
 * Presentational task card (3-zone layout), extracted from KanbanCard.
 * Pure visual — no navigation, no data hooks. Callers own click/interaction:
 * KanbanCard wraps it in its draggable + click handler; mobile surfaces wrap it
 * in a click-to-detail div and pass a status chip or move dropdown as statusControl.
 */
export function TaskCard({ task, showProject, showPoints, statusControl, className }: TaskCardProps) {
  const overdue = isOverdue(task.plannedEndDate, task.workflowStatus?.isClosed);
  const priority = task.priority ? PRIORITY_CONFIG[task.priority] : null;
  const typeVisual = getTypeVisual(task.taskType?.name);
  const TypeIcon = typeVisual.icon;
  const PriorityIcon = priority?.icon;

  return (
    <Card
      className={cn(
        'group relative py-2 rounded-md overflow-visible transition-all duration-150',
        'hover:shadow-md hover:border-border',
        overdue && 'border-t-2 border-t-red-500',
        className,
      )}
    >
      <CardContent className="px-3 py-2 flex flex-col gap-1.5">
        {/* Zone 1: type icon + key (+ optional project chip / status control) */}
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
          {showProject && task.project && (
            <Badge variant="outline" className="px-1.5 py-0 text-[11px] font-medium shrink-0">
              {task.project.prefix ?? task.project.name}
            </Badge>
          )}
          {statusControl && <span className="ml-auto shrink-0">{statusControl}</span>}
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

          {showPoints && task.storyPoints != null && (
            <span className="text-[11px] text-muted-foreground border rounded px-1 leading-tight">
              {task.storyPoints}
            </span>
          )}

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
  );
}
