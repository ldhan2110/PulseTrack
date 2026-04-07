import { useDroppable } from '@dnd-kit/core';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { KanbanCard } from './KanbanCard';
import type { Task, TaskStatus } from '@/lib/types';

const STATUS_LABELS: Record<TaskStatus, string> = {
  BACKLOG: 'Backlog',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  BLOCKED: 'Blocked',
};

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  projectId: string;
  projectPrefix: string;
}

export function KanbanColumn({ status, tasks, projectId, projectPrefix }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <div className="flex flex-col flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-3 px-1">
        <h3 className="text-[13px] font-semibold">{STATUS_LABELS[status]}</h3>
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
              <KanbanCard key={task.id} task={task} projectId={projectId} projectPrefix={projectPrefix} />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
