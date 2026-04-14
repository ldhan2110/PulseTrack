import { useMemo } from 'react';
import { Gantt, Task, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { useUpdateWbsTask, useUpdateWbsSubtask } from '@/hooks/useWbs';
import type { WbsPhase, WbsDependency } from '@/lib/types';

interface WbsGanttChartProps {
  phases: WbsPhase[];
  dependencies: WbsDependency[];
  collapsedIds: Set<string>;
  projectId: string;
}

function toDate(d: string | null, fallback: Date): Date {
  return d ? new Date(d) : fallback;
}

export function WbsGanttChart({ phases, dependencies, collapsedIds, projectId }: WbsGanttChartProps) {
  const updateTask = useUpdateWbsTask(projectId);
  const updateSubtask = useUpdateWbsSubtask(projectId);

  const tasks: Task[] = useMemo(() => {
    const result: Task[] = [];
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    for (const phase of phases) {
      // Phase bar (project type for summary)
      result.push({
        start: toDate(phase.planStart, now),
        end: toDate(phase.planEnd, weekFromNow),
        name: phase.title,
        id: phase.id,
        progress: phase.progress,
        type: 'project',
        hideChildren: collapsedIds.has(phase.id),
        styles: { backgroundColor: '#7c3aed', progressColor: '#a78bfa' },
      });

      if (collapsedIds.has(phase.id)) continue;

      for (const task of phase.tasks) {
        const hasSubtasks = task.subtasks.length > 0;
        result.push({
          start: toDate(task.planStart, now),
          end: toDate(task.planEnd, weekFromNow),
          name: task.title,
          id: task.id,
          progress: task.progress,
          type: hasSubtasks ? 'project' : 'task',
          project: phase.id,
          hideChildren: collapsedIds.has(task.id),
          dependencies: dependencies
            .filter((d) => d.targetId === task.id && d.targetType === 'TASK')
            .map((d) => d.sourceId),
          styles: hasSubtasks
            ? { backgroundColor: '#3b82f6', progressColor: '#60a5fa' }
            : { backgroundColor: '#3b82f6', progressColor: '#22c55e' },
        });

        if (collapsedIds.has(task.id)) continue;

        for (const sub of task.subtasks) {
          result.push({
            start: toDate(sub.planStart, now),
            end: toDate(sub.planEnd, weekFromNow),
            name: sub.title,
            id: sub.id,
            progress: sub.progress,
            type: 'task',
            project: task.id,
            dependencies: dependencies
              .filter((d) => d.targetId === sub.id && d.targetType === 'SUBTASK')
              .map((d) => d.sourceId),
            styles: { backgroundColor: '#6366f1', progressColor: '#22c55e' },
          });
        }
      }
    }
    return result;
  }, [phases, dependencies, collapsedIds]);

  const handleDateChange = (task: Task) => {
    // Determine if this is a task or subtask by checking phases
    for (const phase of phases) {
      const wbsTask = phase.tasks.find((t) => t.id === task.id);
      if (wbsTask && wbsTask.subtasks.length === 0) {
        updateTask.mutate({
          phaseId: wbsTask.phaseId,
          taskId: wbsTask.id,
          data: {
            planStart: task.start.toISOString(),
            planEnd: task.end.toISOString(),
          },
        });
        return;
      }
      for (const t of phase.tasks) {
        const sub = t.subtasks.find((s) => s.id === task.id);
        if (sub) {
          updateSubtask.mutate({
            taskId: sub.taskId,
            subtaskId: sub.id,
            data: {
              planStart: task.start.toISOString(),
              planEnd: task.end.toISOString(),
            },
          });
          return;
        }
      }
    }
  };

  const handleProgressChange = (task: Task) => {
    for (const phase of phases) {
      const wbsTask = phase.tasks.find((t) => t.id === task.id);
      if (wbsTask && wbsTask.subtasks.length === 0) {
        updateTask.mutate({
          phaseId: wbsTask.phaseId,
          taskId: wbsTask.id,
          data: { progress: task.progress },
        });
        return;
      }
      for (const t of phase.tasks) {
        const sub = t.subtasks.find((s) => s.id === task.id);
        if (sub) {
          updateSubtask.mutate({
            taskId: sub.taskId,
            subtaskId: sub.id,
            data: { progress: task.progress },
          });
          return;
        }
      }
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Add phases and tasks to see the Gantt chart
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto [&_.ganttTable]:hidden">
      <Gantt
        tasks={tasks}
        viewMode={ViewMode.Week}
        onDateChange={handleDateChange}
        onProgressChange={handleProgressChange}
        listCellWidth=""
        columnWidth={60}
        barCornerRadius={4}
        todayColor="rgba(239, 68, 68, 0.08)"
        projectBackgroundColor="#7c3aed"
        projectProgressColor="#a78bfa"
        barProgressColor="#22c55e"
        barBackgroundColor="#3b82f6"
      />
    </div>
  );
}
