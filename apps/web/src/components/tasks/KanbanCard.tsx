import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Task } from '@/lib/types';

interface KanbanCardProps {
  task: Task;
  projectId: string;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function KanbanCard({ task, projectId }: KanbanCardProps) {
  const navigate = useNavigate();
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  const handleClick = (e: React.MouseEvent) => {
    // Only navigate if not dragging
    if (!isDragging) {
      navigate(`/projects/${projectId}/tasks/${task.id}`);
    }
    e.stopPropagation();
  };

  const subTaskCount = task.subTasks?.length ?? 0;

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
          'min-h-[80px] transition-all duration-150',
          isDragging && '-translate-y-1 scale-105 shadow-lg',
        )}
      >
        <CardContent className="p-3">
          {task.taskKey && (
            <span className="text-xs font-mono text-muted-foreground">{task.taskKey}</span>
          )}
          <p className="text-sm font-medium line-clamp-2 mb-2">{task.title}</p>
          <div className="flex items-center gap-2">
            {task.assignee ? (
              <Avatar className="size-6">
                <AvatarFallback className="text-[10px]">
                  {getInitials(task.assignee.username)}
                </AvatarFallback>
              </Avatar>
            ) : (
              <div className="size-6 rounded-full bg-muted flex items-center justify-center">
                <span className="text-[10px] text-muted-foreground">?</span>
              </div>
            )}
            {task.storyPoints != null && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0">
                {task.storyPoints}
              </Badge>
            )}
            {subTaskCount > 0 && (
              <span className="text-xs text-muted-foreground ml-auto">
                {subTaskCount} sub-task{subTaskCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
