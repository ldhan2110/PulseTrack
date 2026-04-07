import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { toast } from 'sonner';
import { KanbanColumn } from './KanbanColumn';
import { useUpdateTask } from '@/hooks/useTasks';
import { useWorkflow } from '@/hooks/useWorkflow';
import type { Task } from '@/lib/types';

interface KanbanBoardProps {
  tasks: Task[];
  projectId: string;
  projectPrefix: string;
}

export function KanbanBoard({ tasks, projectId, projectPrefix }: KanbanBoardProps) {
  const updateTask = useUpdateTask(projectId);
  const { data: workflow } = useWorkflow(projectId);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const statuses = workflow?.statuses ?? [];

  const tasksByStatus = statuses.reduce<Record<string, Task[]>>(
    (acc, status) => {
      acc[status.id] = tasks.filter((t) => t.workflowStatusId === status.id);
      return acc;
    },
    {},
  );

  const orphanedTasks = tasks.filter((t) => !t.workflowStatusId);

  const validTransitions = new Set(
    (workflow?.transitions ?? []).map((t) => `${t.fromStatusId}→${t.toStatusId}`),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatusId = over.id as string;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.workflowStatusId === newStatusId) return;

    if (task.workflowStatusId) {
      const transKey = `${task.workflowStatusId}→${newStatusId}`;
      if (!validTransitions.has(transKey)) {
        toast.error('This status transition is not allowed');
        return;
      }
    }

    updateTask.mutate({ taskId, data: { workflowStatusId: newStatusId } });
  };

  const getStatusName = (id: string) => statuses.find((s) => s.id === id)?.name ?? id;

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
      return `Task ${task.title} is over ${getStatusName(over.id as string)} column`;
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
      return `Moved ${task.title} to ${getStatusName(over.id as string)}`;
    },
    onDragCancel: () => 'Drag cancelled',
  };

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd} accessibility={{ announcements }}>
      <div className="flex gap-3 overflow-x-clip h-full pb-4">
        {statuses.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            tasks={tasksByStatus[status.id] ?? []}
            projectId={projectId}
            projectPrefix={projectPrefix}
          />
        ))}
        {orphanedTasks.length > 0 && (
          <KanbanColumn
            key="__orphan__"
            status={{ id: '__orphan__', name: 'No Status', key: '__ORPHAN__', color: '#ef4444', position: 999, isDefault: false, isClosed: false, projectId }}
            tasks={orphanedTasks}
            projectId={projectId}
            projectPrefix={projectPrefix}
          />
        )}
      </div>
    </DndContext>
  );
}
