import { useMemo, useRef, useEffect, useCallback } from 'react';
import { Gantt, type Task, ViewMode } from 'gantt-task-react';
import 'gantt-task-react/dist/index.css';
import { useUpdateWbsTask, useUpdateWbsSubtask } from '@/hooks/useWbs';
import type { WbsPhase, WbsDependency } from '@/lib/types';

const COL_W = 44;
const HEADER_H = 44;

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

  // Inject grid lines into the SVG calendar header after render
  const wrapperRef = useRef<HTMLDivElement>(null);

  const injectHeaderGrid = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const calendarG = el.querySelector('g.calendar');
    if (!calendarG) return;

    // Remove previously injected lines
    calendarG.querySelectorAll('.injected-grid').forEach((n) => n.remove());

    const headerRect = calendarG.querySelector('rect');
    if (!headerRect) return;
    const totalWidth = Number(headerRect.getAttribute('width') || 0);
    const midY = HEADER_H * 0.5;
    const cols = Math.floor(totalWidth / COL_W);

    const ns = 'http://www.w3.org/2000/svg';

    // Horizontal line between month row and date row
    const hLine = document.createElementNS(ns, 'line');
    hLine.setAttribute('x1', '0');
    hLine.setAttribute('y1', String(midY));
    hLine.setAttribute('x2', String(totalWidth));
    hLine.setAttribute('y2', String(midY));
    hLine.classList.add('injected-grid', 'gantt-header-hline');
    calendarG.appendChild(hLine);

    // Vertical lines between each day column (bottom half of header)
    for (let i = 1; i <= cols; i++) {
      const x = COL_W * i;
      const vLine = document.createElementNS(ns, 'line');
      vLine.setAttribute('x1', String(x));
      vLine.setAttribute('y1', String(midY));
      vLine.setAttribute('x2', String(x));
      vLine.setAttribute('y2', String(HEADER_H));
      vLine.classList.add('injected-grid', 'gantt-header-vline');
      calendarG.appendChild(vLine);
    }

    // Center month text vertically within the top half of the header
    const topTexts = calendarG.querySelectorAll<SVGTextElement>('.' + '_2q1Kt');
    topTexts.forEach((txt) => {
      txt.setAttribute('y', String(midY * 0.55));
      txt.setAttribute('dominant-baseline', 'central');
    });
  }, []);

  useEffect(() => {
    injectHeaderGrid();
    // Re-inject when tasks change (causes re-render of the gantt SVG)
  }, [tasks, injectHeaderGrid]);

  if (tasks.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Add phases and tasks to see the Gantt chart
      </div>
    );
  }

  return (
    <div ref={wrapperRef} className="gantt-wrapper h-full overflow-auto [&_.ganttTable]:hidden">
      <Gantt
        tasks={tasks}
        viewMode={ViewMode.Day}
        onDateChange={handleDateChange}
        onProgressChange={handleProgressChange}
        listCellWidth=""
        columnWidth={COL_W}
        headerHeight={HEADER_H}
        rowHeight={33}
        fontSize="11px"
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
