import { useEffect, useState } from 'react';
import { useUiStore } from '@/store/uiStore';
import { useWbsPhases, useWbsDependencies } from '@/hooks/useWbs';
import { WbsToolbar } from '@/components/wbs/WbsToolbar';
import { WbsViewToggle } from '@/components/wbs/WbsViewToggle';
import { WbsTaskTree } from '@/components/wbs/WbsTaskTree';
import { WbsGanttChart } from '@/components/wbs/WbsGanttChart';
import { WbsStatusBar } from '@/components/wbs/WbsStatusBar';
import { WbsTableView } from '@/components/wbs/WbsTableView';
import { WbsTaskDialog } from '@/components/wbs/WbsTaskDialog';
import { ResizablePanel, ResizablePanelGroup, ResizableHandle } from '@/components/ui/resizable';

type ViewMode = 'gantt' | 'table';
type DialogMode = { type: 'phase' | 'task' | 'subtask'; parentId?: string; editItem?: any } | null;

export function WbsPage() {
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const setFullWidth = useUiStore((s) => s.setFullWidth);
  const [viewMode, setViewMode] = useState<ViewMode>('gantt');
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const { data: phases = [] } = useWbsPhases(projectId);
  const { data: dependencies = [] } = useWbsDependencies(projectId);

  useEffect(() => {
    setFullWidth(true);
    return () => setFullWidth(false);
  }, [setFullWidth]);

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const taskCount = phases.reduce((sum, p) => sum + p.tasks.length, 0);
  const subtaskCount = phases.reduce(
    (sum, p) => sum + p.tasks.reduce((s, t) => s + t.subtasks.length, 0),
    0,
  );
  const overallProgress =
    phases.length > 0
      ? Math.round(phases.reduce((sum, p) => sum + p.progress, 0) / phases.length)
      : 0;

  return (
    <div className="flex h-[calc(100vh-5rem)] flex-col">
      <WbsToolbar
        onAddPhase={() => setDialogMode({ type: 'phase' })}
      />
      <WbsViewToggle viewMode={viewMode} onChange={setViewMode} />

      <div className="flex-1 overflow-hidden">
        {viewMode === 'gantt' ? (
          <ResizablePanelGroup orientation="horizontal" className="h-full">
            <ResizablePanel defaultSize={45} minSize={30}>
              <WbsTaskTree
                phases={phases}
                collapsedIds={collapsedIds}
                onToggleCollapse={toggleCollapse}
                onAddTask={(phaseId) => setDialogMode({ type: 'task', parentId: phaseId })}
                onAddSubtask={(taskId) => setDialogMode({ type: 'subtask', parentId: taskId })}
                onEditPhase={(phase) => setDialogMode({ type: 'phase', editItem: phase })}
                onEditTask={(task) => setDialogMode({ type: 'task', editItem: task })}
                onEditSubtask={(subtask) => setDialogMode({ type: 'subtask', editItem: subtask })}
                projectId={projectId}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={55} minSize={30}>
              <WbsGanttChart
                phases={phases}
                dependencies={dependencies}
                collapsedIds={collapsedIds}
                projectId={projectId}
              />
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          <WbsTableView
            phases={phases}
            collapsedIds={collapsedIds}
            onToggleCollapse={toggleCollapse}
            onEditPhase={(phase) => setDialogMode({ type: 'phase', editItem: phase })}
            onEditTask={(task) => setDialogMode({ type: 'task', editItem: task })}
            onEditSubtask={(subtask) => setDialogMode({ type: 'subtask', editItem: subtask })}
            projectId={projectId}
          />
        )}
      </div>

      <WbsStatusBar
        phaseCount={phases.length}
        taskCount={taskCount}
        subtaskCount={subtaskCount}
        overallProgress={overallProgress}
      />

      {dialogMode && (
        <WbsTaskDialog
          mode={dialogMode}
          projectId={projectId}
          onClose={() => setDialogMode(null)}
        />
      )}
    </div>
  );
}
