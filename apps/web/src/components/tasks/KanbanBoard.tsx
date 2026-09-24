import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useNavigate } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { KanbanColumn } from './KanbanColumn';
import { TaskCard } from './TaskCard';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { useUpdateTask } from '@/hooks/useTasks';
import { useWorkflow } from '@/hooks/useWorkflow';
import { usePermissions } from '@/hooks/usePermissions';
import { useProject } from '@/hooks/useProjects';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { type FieldConfig } from '@/lib/fieldConfig';
import type { Task, WorkflowStatus } from '@/lib/types';

interface KanbanBoardProps {
  tasks: Task[];
  projectId: string;
  projectPrefix: string;
}

export function KanbanBoard({ tasks, projectId, projectPrefix }: KanbanBoardProps) {
  const updateTask = useUpdateTask(projectId);
  const { data: workflow } = useWorkflow(projectId);
  const { can } = usePermissions(projectId);
  const { data: project } = useProject(projectId);
  const fieldConfig: FieldConfig | null | undefined = project?.fieldConfig;
  const isMobile = useIsMobile();
  const navigate = useNavigate();

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

  const orphanStatus: WorkflowStatus = {
    id: '__orphan__', name: 'No Status', key: '__ORPHAN__', color: '#ef4444',
    position: 999, isDefault: false, isClosed: false, projectId,
    autoDateField: null, autoDateAction: null,
  };

  const validTransitions = new Set(
    (workflow?.transitions ?? []).map((t) => `${t.fromStatusId}→${t.toStatusId}`),
  );

  // Shared status-move guard used by desktop drag-and-drop and the mobile move dropdown.
  const moveTask = (task: Task, newStatusId: string) => {
    if (task.workflowStatusId === newStatusId) return;

    if (!can('tasks', 'update')) {
      toast.error('You do not have permission to move tasks');
      return;
    }

    if (task.workflowStatusId) {
      const transKey = `${task.workflowStatusId}→${newStatusId}`;
      if (!validTransitions.has(transKey)) {
        toast.error('This status transition is not allowed');
        return;
      }
    }

    updateTask.mutate({ taskId: task.id, data: { workflowStatusId: newStatusId } });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const task = tasks.find((t) => t.id === (active.id as string));
    if (!task) return;
    moveTask(task, over.id as string);
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

  // Mobile: vertical status stream instead of horizontal columns (no touch DnD).
  if (isMobile) {
    const sections = [
      ...statuses,
      ...(orphanedTasks.length > 0 ? [orphanStatus] : []),
    ];
    const listFor = (status: WorkflowStatus) =>
      status.id === '__orphan__' ? orphanedTasks : (tasksByStatus[status.id] ?? []);
    const openTask = (task: Task) =>
      navigate(`/projects/${projectPrefix}/tasks/${task.taskKey ?? task.id}`);

    return (
      // Mobile scrolls with the page's <main> (overflow-auto); px-0.5 keeps card borders off the edge.
      <div className="flex flex-col gap-4 pb-4 px-0.5">
        {sections.map((status) => {
          const list = listFor(status);
          return (
            <section key={status.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: status.color }} />
                <span className="text-sm font-semibold">{status.name}</span>
                <span className="text-sm text-muted-foreground">{list.length}</span>
              </div>
              {list.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {list.map((task) => (
                    <div key={task.id} onClick={() => openTask(task)} className="cursor-pointer">
                      <TaskCard
                        task={task}
                        showPoints
                        fieldConfig={fieldConfig}
                        statusControl={
                          <MobileMoveMenu
                            task={task}
                            statuses={statuses}
                            onMove={(statusId) => moveTask(task, statusId)}
                          />
                        }
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">No tasks in this status</p>
              )}
            </section>
          );
        })}
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd} accessibility={{ announcements }}>
      <div className="flex gap-3 overflow-x-auto h-full pb-4">
        {statuses.map((status) => (
          <KanbanColumn
            key={status.id}
            status={status}
            tasks={tasksByStatus[status.id] ?? []}
            projectId={projectId}
            projectPrefix={projectPrefix}
            fieldConfig={fieldConfig}
          />
        ))}
        {orphanedTasks.length > 0 && (
          <KanbanColumn
            key="__orphan__"
            status={orphanStatus}
            tasks={orphanedTasks}
            projectId={projectId}
            projectPrefix={projectPrefix}
            fieldConfig={fieldConfig}
          />
        )}
      </div>
    </DndContext>
  );
}

interface MobileMoveMenuProps {
  task: Task;
  statuses: WorkflowStatus[];
  onMove: (statusId: string) => void;
}

/** Per-card status dropdown for the mobile board — replaces touch drag-and-drop. */
function MobileMoveMenu({ task, statuses, onMove }: MobileMoveMenuProps) {
  const current = statuses.find((s) => s.id === task.workflowStatusId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-2 py-0.5',
            'text-[11px] text-muted-foreground hover:bg-accent',
          )}
        >
          {current?.name ?? 'No Status'}
          <ChevronDown className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
        {statuses.map((status) => (
          <DropdownMenuItem
            key={status.id}
            disabled={status.id === task.workflowStatusId}
            onSelect={() => onMove(status.id)}
          >
            <span className="size-2 rounded-full mr-2" style={{ backgroundColor: status.color }} />
            {status.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
