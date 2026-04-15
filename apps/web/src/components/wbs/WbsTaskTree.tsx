import { WbsTaskRow } from './WbsTaskRow';
import type { WbsPhase, WbsTask, WbsSubtask } from '@/lib/types';
import { useDeleteWbsPhase, useDeleteWbsTask, useDeleteWbsSubtask } from '@/hooks/useWbs';

interface WbsTaskTreeProps {
  phases: WbsPhase[];
  collapsedIds: Set<string>;
  onToggleCollapse: (id: string) => void;
  onAddTask: (phaseId: string) => void;
  onAddSubtask: (taskId: string) => void;
  onEditPhase: (phase: WbsPhase) => void;
  onEditTask: (task: WbsTask) => void;
  onEditSubtask: (subtask: WbsSubtask) => void;
  projectId: string;
  scrollRef?: React.RefObject<HTMLDivElement | null>;
}

function formatDate(d: string | null) {
  if (!d) return '\u2014';
  const dt = new Date(d);
  const day = String(dt.getDate()).padStart(2, '0');
  const month = String(dt.getMonth() + 1).padStart(2, '0');
  const year = dt.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatProgress(p: number) {
  return `${Math.round(p)}%`;
}

export function WbsTaskTree({
  phases, collapsedIds, onToggleCollapse,
  onAddTask, onAddSubtask, onEditPhase, onEditTask, onEditSubtask, projectId, scrollRef,
}: WbsTaskTreeProps) {
  const deletePhase = useDeleteWbsPhase(projectId);
  const deleteTask = useDeleteWbsTask(projectId);
  const deleteSubtask = useDeleteWbsSubtask(projectId);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[1fr_68px_68px_68px_68px_50px] gap-0 border-b bg-muted/30 px-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground items-center" style={{ height: 44 }}>
        <span className="pl-2">Task</span>
        <span>Plan S.</span>
        <span>Plan E.</span>
        <span>Act. S.</span>
        <span>Act. E.</span>
        <span>Prog.</span>
      </div>

      {/* Rows */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {phases.map((phase) => {
          const phaseCollapsed = collapsedIds.has(phase.id);
          const hasChildren = phase.tasks.length > 0;
          return (
            <div key={phase.id}>
              {/* Phase row */}
              <WbsTaskRow
                level={0}
                title={phase.title}
                planStart={formatDate(phase.planStart)}
                planEnd={formatDate(phase.planEnd)}
                actualStart={formatDate(phase.actualStart)}
                actualEnd={formatDate(phase.actualEnd)}
                progress={formatProgress(phase.progress)}
                isRollup={hasChildren}
                isCollapsed={phaseCollapsed}
                onToggle={() => onToggleCollapse(phase.id)}
                onEdit={() => onEditPhase(phase)}
                onDelete={() => deletePhase.mutate(phase.id)}
                onAdd={() => onAddTask(phase.id)}
              />

              {/* Tasks */}
              {!phaseCollapsed &&
                phase.tasks.map((task) => {
                  const taskCollapsed = collapsedIds.has(task.id);
                  const taskHasChildren = task.subtasks.length > 0;
                  return (
                    <div key={task.id}>
                      <WbsTaskRow
                        level={1}
                        title={task.title}
                        planStart={formatDate(task.planStart)}
                        planEnd={formatDate(task.planEnd)}
                        actualStart={formatDate(task.actualStart)}
                        actualEnd={formatDate(task.actualEnd)}
                        progress={formatProgress(task.progress)}
                        isRollup={taskHasChildren}
                        isCollapsed={taskCollapsed}
                        onToggle={taskHasChildren ? () => onToggleCollapse(task.id) : undefined}
                        onEdit={() => onEditTask(task)}
                        onDelete={() => deleteTask.mutate({ phaseId: task.phaseId, taskId: task.id })}
                        onAdd={() => onAddSubtask(task.id)}
                        backlogItemId={task.backlogItemId}
                      />

                      {/* Subtasks */}
                      {!taskCollapsed &&
                        task.subtasks.map((subtask) => (
                          <WbsTaskRow
                            key={subtask.id}
                            level={2}
                            title={subtask.title}
                            planStart={formatDate(subtask.planStart)}
                            planEnd={formatDate(subtask.planEnd)}
                            actualStart={formatDate(subtask.actualStart)}
                            actualEnd={formatDate(subtask.actualEnd)}
                            progress={formatProgress(subtask.progress)}
                            isRollup={false}
                            onEdit={() => onEditSubtask(subtask)}
                            onDelete={() =>
                              deleteSubtask.mutate({ taskId: subtask.taskId, subtaskId: subtask.id })
                            }
                            backlogItemId={subtask.backlogItemId}
                          />
                        ))}
                    </div>
                  );
                })}
            </div>
          );
        })}

        {phases.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            No phases yet. Click &quot;Add Phase&quot; to get started.
          </div>
        )}
      </div>
    </div>
  );
}
