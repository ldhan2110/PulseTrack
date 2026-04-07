import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Task, Priority } from '@/lib/types';

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
        )}
      >
        {/* Overdue red gradient strip */}
        {overdue && (
          <div className="h-[3px] w-full bg-gradient-to-r from-red-500 via-red-400 to-red-500" />
        )}

        <CardContent className="p-3 flex flex-col gap-2">
          {/* Top row: task key + priority */}
          <div className="flex items-center justify-between gap-2">
            {task.taskKey ? (
              <span className="text-xs font-mono text-muted-foreground">{task.taskKey}</span>
            ) : (
              <span />
            )}
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

          {/* Title */}
          <p className="text-sm font-medium line-clamp-2">{task.title}</p>

          {/* Footer row */}
          <div className="flex items-center justify-between border-t border-border/40 pt-2 mt-auto">
            {/* Left: assignee + story points */}
            <div className="flex items-center gap-1.5">
              {task.assignee ? (
                <Avatar className="size-5">
                  <AvatarFallback className="text-[9px]">
                    {getInitials(task.assignee.username)}
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
        </CardContent>
      </Card>
    </div>
  );
}
