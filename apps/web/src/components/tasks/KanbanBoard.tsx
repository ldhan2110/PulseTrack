import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { KanbanColumn } from './KanbanColumn';
import { useUpdateTaskStatus } from '@/hooks/useTasks';
import type { Task, TaskStatus } from '@/lib/types';

const TASK_STATUSES: TaskStatus[] = ['BACKLOG', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'BLOCKED'];

interface KanbanBoardProps {
  tasks: Task[];
  projectId: string;
  projectPrefix: string;
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  BACKLOG: 'Backlog',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  BLOCKED: 'Blocked',
};

export function KanbanBoard({ tasks, projectId, projectPrefix }: KanbanBoardProps) {
  const updateTaskStatus = useUpdateTaskStatus(projectId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const tasksByStatus = TASK_STATUSES.reduce<Record<TaskStatus, Task[]>>(
    (acc, status) => {
      acc[status] = tasks.filter((t) => t.status === status);
      return acc;
    },
    { BACKLOG: [], IN_PROGRESS: [], IN_REVIEW: [], DONE: [], BLOCKED: [] },
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as TaskStatus;

    if (!TASK_STATUSES.includes(newStatus)) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    updateTaskStatus.mutate({ taskId, status: newStatus });
  };

  const announcements = {
    onDragStart: ({ active }: { active: { id: string | number } }) => {
      const task = tasks.find((t) => t.id === active.id);
      return task ? `Picked up task: ${task.title}` : '';
    },
    onDragOver: ({
      active,
      over,
    }: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) => {
      const task = tasks.find((t) => t.id === active.id);
      if (!task || !over) return '';
      const statusLabel = STATUS_LABELS[over.id as TaskStatus] ?? String(over.id);
      return `Task ${task.title} is over ${statusLabel} column`;
    },
    onDragEnd: ({
      active,
      over,
    }: {
      active: { id: string | number };
      over: { id: string | number } | null;
    }) => {
      const task = tasks.find((t) => t.id === active.id);
      if (!task || !over) return 'Drag cancelled';
      const statusLabel = STATUS_LABELS[over.id as TaskStatus] ?? String(over.id);
      return `Moved ${task.title} to ${statusLabel}`;
    },
    onDragCancel: () => 'Drag cancelled',
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd} accessibility={{ announcements }}>
      <div className="flex gap-3 overflow-hidden h-full pb-4">
        {TASK_STATUSES.map((status) => (
          <KanbanColumn
            key={status}
            status={status}
            tasks={tasksByStatus[status]}
            projectId={projectId}
            projectPrefix={projectPrefix}
          />
        ))}
      </div>
    </DndContext>
  );
}
