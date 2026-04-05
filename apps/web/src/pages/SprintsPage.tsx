import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useSprints, useActivateSprint, useCloseSprint } from '@/hooks/useSprints';
import { useTasks } from '@/hooks/useTasks';
import { useProjectRole } from '@/hooks/useProjectRole';
import { SprintListItem } from '@/components/sprints/SprintListItem';
import { CreateSprintDialog } from '@/components/sprints/CreateSprintDialog';
import type { Sprint } from '@/lib/types';

export function SprintsPage() {
  const { projectId = '' } = useParams<{ projectId: string }>();
  const { data: sprints, isLoading } = useSprints(projectId);
  const { data: tasks = [] } = useTasks(projectId);
  const { canManage } = useProjectRole(projectId);
  const activateSprint = useActivateSprint(projectId);
  const closeSprint = useCloseSprint(projectId);
  const [createOpen, setCreateOpen] = useState(false);

  // Sort: ACTIVE first, then PLANNED (most recent first), then COMPLETED (most recent first)
  const sortedSprints = useMemo(() => {
    if (!sprints) return [];
    const active = sprints.filter((s) => s.status === 'ACTIVE');
    const planned = sprints.filter((s) => s.status === 'PLANNED');
    const closed = sprints
      .filter((s) => s.status === 'COMPLETED')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    return [...active, ...planned, ...closed];
  }, [sprints]);

  // Count incomplete tasks per sprint (not DONE)
  const incompleteCountBySprint = useMemo(() => {
    const map: Record<string, number> = {};
    tasks.forEach((t) => {
      if (t.sprintId && t.status !== 'DONE') {
        map[t.sprintId] = (map[t.sprintId] ?? 0) + 1;
      }
    });
    return map;
  }, [tasks]);

  const handleActivate = (sprint: Sprint) => {
    activateSprint.mutate(sprint.id);
  };

  const handleClose = (sprint: Sprint) => {
    closeSprint.mutate(sprint.id);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!sortedSprints.length) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Sprints</h1>
          {canManage && (
            <Button onClick={() => setCreateOpen(true)}>Create Sprint</Button>
          )}
        </div>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4 max-w-[360px] text-center">
            <Calendar className="size-12 text-muted-foreground" />
            <div>
              <h2 className="text-[20px] font-semibold">No sprints created</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Create your first sprint to organize work into time-boxed iterations.
              </p>
            </div>
            {canManage && (
              <Button onClick={() => setCreateOpen(true)}>Create Sprint</Button>
            )}
          </div>
        </div>
        <CreateSprintDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          projectId={projectId}
          existingSprints={sprints ?? []}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Sprints</h1>
        {canManage && (
          <Button onClick={() => setCreateOpen(true)}>Create Sprint</Button>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {sortedSprints.map((sprint) => (
          <SprintListItem
            key={sprint.id}
            sprint={sprint}
            isActive={sprint.status === 'ACTIVE'}
            canManage={canManage}
            projectId={projectId}
            incompleteTasks={incompleteCountBySprint[sprint.id] ?? 0}
            onActivate={() => handleActivate(sprint)}
            onClose={() => handleClose(sprint)}
          />
        ))}
      </div>

      <CreateSprintDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId}
        existingSprints={sprints ?? []}
      />
    </div>
  );
}
