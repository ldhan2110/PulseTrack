import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { TaskCard } from './TaskCard';
import type { Task } from '@/lib/types';

interface KanbanCardProps {
  task: Task;
  projectId: string;
  projectPrefix: string;
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
      <TaskCard
        task={task}
        className={cn(isDragging && '-translate-y-1 scale-105 shadow-lg')}
      />
    </div>
  );
}
