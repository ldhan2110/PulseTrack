import { useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useUiStore } from '@/store/uiStore';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useSprint } from '@/hooks/useSprints';
import { useTasks } from '@/hooks/useTasks';
import { useMembers } from '@/hooks/useMembers';
import { useSprints } from '@/hooks/useSprints';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { TasksTable } from '@/components/tasks/TasksTable';
import { format } from 'date-fns';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

export function SprintBoardPage() {
  const { sprintId = '', projectPrefix = '' } = useParams<{ sprintId: string; projectPrefix: string }>();
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const navigate = useNavigate();
  const { data: sprint, isLoading: sprintLoading, isError: sprintError } = useSprint(projectId, sprintId);
  const { data: allTasks, isLoading: tasksLoading } = useTasks(projectId);
  const { data: members = [] } = useMembers(projectId);
  const { data: sprints = [] } = useSprints(projectId);
  const [view, setView] = useState<'table' | 'board'>('board');

  // Filter tasks to only this sprint
  const sprintTasks = useMemo(() => {
    if (!allTasks) return [];
    return allTasks.filter((t) => t.sprintId === sprintId);
  }, [allTasks, sprintId]);

  // Sprint progress calculations
  const { completedPoints, totalPoints, progressPercent } = useMemo(() => {
    const total = sprintTasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
    const completed = sprintTasks
      .filter((t) => t.status === 'DONE')
      .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completedPoints: completed, totalPoints: total, progressPercent: percent };
  }, [sprintTasks]);

  const isLoading = sprintLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-8">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-sm" />
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
        <div className="flex gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 min-w-[240px]">
              <Skeleton className="h-8 w-full" />
              {Array.from({ length: 2 }).map((_, j) => (
                <Skeleton key={j} className="h-20 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (sprintError || !sprint) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-4 max-w-[360px] text-center">
          <p className="text-sm text-muted-foreground">
            This sprint doesn't exist or has been deleted.
          </p>
          <Link
            to={`/projects/${projectId}/sprints`}
            className="text-sm font-medium underline underline-offset-4"
          >
            Go to Sprints
          </Link>
        </div>
      </div>
    );
  }

  const isCompleted = sprint.status === 'COMPLETED';

  return (
    <div className="flex flex-col gap-4 p-8">
      {/* Back navigation */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 -ml-2 w-fit"
        onClick={() => navigate(`/projects/${projectId}/sprints`)}
      >
        ← Back to Sprints
      </Button>

      {/* Page header */}
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold tracking-tight">{sprint.name}</h1>
        <Badge variant={sprint.status === 'ACTIVE' ? 'default' : sprint.status === 'PLANNED' ? 'outline' : 'secondary'}>
          {sprint.status === 'COMPLETED' ? 'Completed' : sprint.status === 'ACTIVE' ? 'Active' : 'Planned'}
        </Badge>
        <span className="text-sm text-muted-foreground">
          {formatDate(sprint.startDate)} — {formatDate(sprint.endDate)}
        </span>
      </div>

      {/* Progress bar */}
      {totalPoints > 0 && (
        <div className="flex flex-col gap-1.5 max-w-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-semibold">Progress</span>
            <span className="text-xs text-muted-foreground">
              {completedPoints} / {totalPoints} points
            </span>
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>
      )}

      {/* Empty state */}
      {sprintTasks.length === 0 ? (
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4 max-w-[360px] text-center">
            <Zap className="size-12 text-muted-foreground" />
            <div>
              <h2 className="text-[20px] font-semibold">Sprint is empty</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Add tasks from the backlog to start tracking sprint progress.
              </p>
            </div>
            <Button
              variant="outline"
              asChild
            >
              <Link to={`/projects/${projectId}/backlog`}>Go to Backlog</Link>
            </Button>
          </div>
        </div>
      ) : (
        <Tabs
          value={view}
          onValueChange={(v) => setView(v as 'table' | 'board')}
        >
          <TabsList>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="table">Table</TabsTrigger>
          </TabsList>

          <TabsContent value="board" className="mt-4">
            {isCompleted ? (
              <div className="mb-3 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 inline-block">
                This sprint is closed — board is read-only.
              </div>
            ) : null}
            <KanbanBoard tasks={sprintTasks} projectId={projectId} projectPrefix={projectPrefix} />
          </TabsContent>

          <TabsContent value="table" className="mt-4">
            <TasksTable
              tasks={sprintTasks}
              projectId={projectId}
              projectPrefix={projectPrefix}
              members={members}
              sprints={sprints}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
