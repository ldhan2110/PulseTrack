import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface WbsTreePreviewProps {
  phases: any[];
}

export function WbsTreePreview({ phases }: WbsTreePreviewProps) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const totalTasks = phases.reduce((acc, p) => acc + (p.tasks?.length ?? 0), 0);
  const totalSubtasks = phases.reduce(
    (acc, p) =>
      acc + (p.tasks ?? []).reduce((a: number, t: any) => a + (t.subtasks?.length ?? 0), 0),
    0,
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-sm font-semibold">Generated WBS Preview</span>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{phases.length} phases</Badge>
          <Badge variant="secondary">{totalTasks} tasks</Badge>
          <Badge variant="secondary">{totalSubtasks} subtasks</Badge>
        </div>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {phases.map((phase, phaseIndex) => {
          const phaseId = `phase-${phaseIndex}`;
          const isPhaseCollapsed = collapsedIds.has(phaseId);

          return (
            <div key={phaseId}>
              {/* Phase row */}
              <button
                type="button"
                className="w-full flex items-center gap-2 px-3 py-2 rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-left"
                onClick={() => toggleCollapse(phaseId)}
              >
                {isPhaseCollapsed ? (
                  <ChevronRight className="h-4 w-4 shrink-0 text-purple-500" />
                ) : (
                  <ChevronDown className="h-4 w-4 shrink-0 text-purple-500" />
                )}
                <span className="flex-1 text-sm font-medium">{phase.name ?? phase.title}</span>
                {(phase.startDate || phase.endDate) && (
                  <span className="text-xs text-muted-foreground shrink-0">
                    {phase.startDate ?? ''}{phase.startDate && phase.endDate ? ' → ' : ''}{phase.endDate ?? ''}
                  </span>
                )}
              </button>

              {/* Tasks */}
              {!isPhaseCollapsed &&
                (phase.tasks ?? []).map((task: any, taskIndex: number) => {
                  const taskId = `task-${phaseIndex}-${taskIndex}`;
                  const isTaskCollapsed = collapsedIds.has(taskId);

                  return (
                    <div key={taskId} className="ml-4">
                      {/* Task row */}
                      <button
                        type="button"
                        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-blue-500/10 text-left"
                        onClick={() => toggleCollapse(taskId)}
                      >
                        {isTaskCollapsed ? (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-blue-500" />
                        )}
                        <span className="flex-1 text-sm">{task.name ?? task.title}</span>
                        {(task.startDate || task.endDate) && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {task.startDate ?? ''}{task.startDate && task.endDate ? ' → ' : ''}{task.endDate ?? ''}
                          </span>
                        )}
                      </button>

                      {/* Subtasks */}
                      {!isTaskCollapsed &&
                        (task.subtasks ?? []).map((subtask: any, subtaskIndex: number) => (
                          <div
                            key={`subtask-${phaseIndex}-${taskIndex}-${subtaskIndex}`}
                            className="ml-6 flex items-center gap-2 px-3 py-1 rounded-md"
                          >
                            <span className="text-indigo-400 text-sm shrink-0">↳</span>
                            <span className="flex-1 text-sm text-indigo-300">
                              {subtask.name ?? subtask.title}
                            </span>
                            {(subtask.startDate || subtask.endDate) && (
                              <span className="text-xs text-muted-foreground shrink-0">
                                {subtask.startDate ?? ''}{subtask.startDate && subtask.endDate ? ' → ' : ''}{subtask.endDate ?? ''}
                              </span>
                            )}
                          </div>
                        ))}
                    </div>
                  );
                })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
