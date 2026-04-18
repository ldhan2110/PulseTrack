import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
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
import { useWorkflow } from '@/hooks/useWorkflow';
import { useSavedFilters, useCreateSavedFilter, useUpdateSavedFilter, useDeleteSavedFilter } from '@/hooks/useSavedFilters';
import { SavedQueryDropdown } from '@/components/tasks/SavedQueryDropdown';
import type { ColumnFiltersState } from '@tanstack/react-table';
import type { SavedFilter, SavedFilterData } from '@/lib/types';
import { format } from 'date-fns';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

function savedFilterDataToColumnFilters(data: SavedFilterData): ColumnFiltersState {
  const filters: ColumnFiltersState = [];
  if (data.statuses && data.statuses.length > 0) {
    filters.push({ id: 'workflowStatusId', value: data.statuses });
  }
  if (data.assignees && data.assignees.length > 0) {
    filters.push({ id: 'assigneeId', value: data.assignees });
  }
  if (data.sprint) {
    filters.push({ id: 'sprintId', value: data.sprint });
  }
  if (data.progress && data.progress.length > 0) {
    filters.push({ id: 'progress', value: data.progress });
  }
  return filters;
}

function columnFiltersToSavedFilterData(filters: ColumnFiltersState, globalFilter: string): SavedFilterData {
  const data: SavedFilterData = {};
  for (const f of filters) {
    switch (f.id) {
      case 'workflowStatusId': data.statuses = f.value as string[]; break;
      case 'assigneeId': data.assignees = f.value as string[]; break;
      case 'sprintId': data.sprint = f.value as string; break;
      case 'progress': data.progress = f.value as string[]; break;
    }
  }
  if (globalFilter) data.search = globalFilter;
  return data;
}

export function SprintBoardPage() {
  const { sprintId = '', projectPrefix = '' } = useParams<{ sprintId: string; projectPrefix: string }>();
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const navigate = useNavigate();
  const { data: sprint, isLoading: sprintLoading, isError: sprintError } = useSprint(projectId, sprintId);
  const { data: allTasks, isLoading: tasksLoading } = useTasks(projectId);
  const { data: members = [] } = useMembers(projectId);
  const { data: sprints = [] } = useSprints(projectId);
  const { data: workflow } = useWorkflow(projectId);
  const workflowStatuses = workflow?.statuses ?? [];
  const { data: savedFilters = [] } = useSavedFilters(projectId, 'task');
  const createSavedFilter = useCreateSavedFilter(projectId);
  const updateSavedFilter = useUpdateSavedFilter(projectId, 'task');
  const deleteSavedFilter = useDeleteSavedFilter(projectId, 'task');

  const [activeFilterId, setActiveFilterId] = useState<string | null>(null);
  const [isFilterModified, setIsFilterModified] = useState(false);
  const currentFiltersRef = useRef<{ filters: ColumnFiltersState; globalFilter: string }>({ filters: [], globalFilter: '' });
  const [view, setView] = useState<'table' | 'board'>('board');

  const defaultSavedFilter = savedFilters.find((f) => f.isDefault);

  const initialFilters = useMemo<ColumnFiltersState>(() => {
    if (defaultSavedFilter) {
      return savedFilterDataToColumnFilters(defaultSavedFilter.filters);
    }
    const openStatusIds = workflowStatuses
      .filter((s) => !s.isClosed)
      .map((s) => s.id);
    if (openStatusIds.length > 0 && openStatusIds.length < workflowStatuses.length) {
      return [{ id: 'workflowStatusId', value: openStatusIds }];
    }
    return [];
  }, [defaultSavedFilter, workflowStatuses]);

  useEffect(() => {
    if (defaultSavedFilter && !activeFilterId) {
      setActiveFilterId(defaultSavedFilter.id);
    }
  }, [defaultSavedFilter, activeFilterId]);

  const handleFiltersChange = useCallback((filters: ColumnFiltersState, globalFilter: string) => {
    currentFiltersRef.current = { filters, globalFilter };
    setIsFilterModified(true);
  }, []);

  const handleSelectFilter = (filter: SavedFilter) => {
    setActiveFilterId(filter.id);
    setIsFilterModified(false);
  };

  const handleSaveFilter = (name: string, isDefault: boolean) => {
    const { filters, globalFilter } = currentFiltersRef.current;
    createSavedFilter.mutate({
      name,
      entityType: 'task',
      filters: columnFiltersToSavedFilterData(filters, globalFilter),
      isDefault,
    });
  };

  const handleSetDefault = (id: string, isDefault: boolean) => {
    updateSavedFilter.mutate({ id, data: { isDefault } });
  };

  const handleDeleteFilter = (id: string) => {
    deleteSavedFilter.mutate(id);
    if (activeFilterId === id) {
      setActiveFilterId(null);
      setIsFilterModified(false);
    }
  };

  // Filter tasks to only this sprint
  const sprintTasks = useMemo(() => {
    if (!allTasks) return [];
    return allTasks.filter((t) => t.sprintId === sprintId);
  }, [allTasks, sprintId]);

  // Sprint progress calculations
  const { completedPoints, totalPoints, progressPercent } = useMemo(() => {
    const total = sprintTasks.reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
    const completed = sprintTasks
      .filter((t) => t.workflowStatus?.isClosed === true)
      .reduce((sum, t) => sum + (t.storyPoints ?? 0), 0);
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completedPoints: completed, totalPoints: total, progressPercent: percent };
  }, [sprintTasks]);

  const isLoading = sprintLoading || tasksLoading;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
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
            to={`/projects/${projectPrefix}/sprints`}
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
    <div className="flex flex-col gap-4">
      {/* Back navigation */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 -ml-2 w-fit"
        onClick={() => navigate(`/projects/${projectPrefix}/sprints`)}
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
              <Link to={`/projects/${projectPrefix}/backlog`}>Go to Backlog</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-2">
          <SavedQueryDropdown
            savedFilters={savedFilters}
            activeFilterId={activeFilterId}
            isModified={isFilterModified}
            onSelect={handleSelectFilter}
            onSave={handleSaveFilter}
            onSetDefault={handleSetDefault}
            onDelete={handleDeleteFilter}
          />
        </div>

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
              workflowStatuses={workflowStatuses}
              initialFilters={initialFilters}
              onFiltersChange={handleFiltersChange}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
