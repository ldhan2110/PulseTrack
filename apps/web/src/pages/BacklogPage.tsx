import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ListTodo, Sparkles } from 'lucide-react';
import { useAiConfig } from '@/hooks/useAiConfig';
import { useRepositoryConfig } from '@/hooks/useRepositoryConfig';
import { useAiTaskGeneration } from '@/hooks/useAiTaskGeneration';
import { GenerateTasksModal } from '@/components/tasks/GenerateTasksModal';
import { TaskGenerationWizard } from '@/components/tasks/TaskGenerationWizard';
import { useTasks, useDeleteTask } from '@/hooks/useTasks';
import { useSprints } from '@/hooks/useSprints';
import { useMembers } from '@/hooks/useMembers';
import { useProjectRole } from '@/hooks/useProjectRole';
import { useUiStore } from '@/store/uiStore';
import { useUpdateTask } from '@/hooks/useTasks';
import { KanbanBoard } from '@/components/tasks/KanbanBoard';
import { TasksTable, BulkActionBar } from '@/components/tasks/TasksTable';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import type { Task } from '@/lib/types';

export function BacklogPage() {
  const { projectPrefix = '' } = useParams<{ projectPrefix: string }>();
  const projectId = useUiStore((s) => s.activeProjectId) ?? '';
  const { data: tasks, isLoading: tasksLoading } = useTasks(projectId);
  const { data: sprints = [] } = useSprints(projectId);
  const { data: members = [] } = useMembers(projectId);
  const { canEdit } = useProjectRole(projectId);
  const backlogView = useUiStore((s) => s.backlogView);
  const setBacklogView = useUiStore((s) => s.setBacklogView);
  const setFullWidth = useUiStore((s) => s.setFullWidth);
  const [createOpen, setCreateOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const { data: aiConfig } = useAiConfig(projectId);
  const { data: repoConfig } = useRepositoryConfig(projectId);
  const aiGeneration = useAiTaskGeneration(projectId);

  const canGenerate = !!aiConfig && repoConfig?.cloneStatus === 'cloned';

  // Open wizard when generation completes
  const handleGenerateSubmit = (formData: FormData) => {
    aiGeneration.generate.mutate(formData);
  };

  // Open wizard when generation completes
  useEffect(() => {
    if (aiGeneration.isCompleted && aiGeneration.tasks.length > 0 && !wizardOpen) {
      setGenerateOpen(false);
      setWizardOpen(true);
    }
  }, [aiGeneration.isCompleted, aiGeneration.tasks.length, wizardOpen]);

  useEffect(() => {
    setFullWidth(backlogView === 'board');
    return () => setFullWidth(false);
  }, [backlogView, setFullWidth]);
  const [selectedTasks, setSelectedTasks] = useState<Task[]>([]);
  const updateTask = useUpdateTask(projectId);
  const deleteTask = useDeleteTask(projectId);

  const handleBulkMoveToSprint = (sprintId: string | null) => {
    selectedTasks.forEach((task) => {
      updateTask.mutate({ taskId: task.id, data: { sprintId } });
    });
    setSelectedTasks([]);
  };

  const handleBulkDelete = () => {
    selectedTasks.forEach((task) => {
      deleteTask.mutate(task.id);
    });
    setSelectedTasks([]);
  };

  if (tasksLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-9 w-28" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
        {backlogView === 'table' ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : (
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
        )}
      </div>
    );
  }

  const taskList = tasks ?? [];

  if (taskList.length === 0 && !tasksLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight">Backlog</h1>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setGenerateOpen(true)}
                disabled={!canGenerate}
                title={!canGenerate ? 'Configure AI settings and clone repository first' : 'Generate tasks with AI'}
              >
                <Sparkles className="size-4 mr-1" />
                Generate with AI
              </Button>
              <Button onClick={() => setCreateOpen(true)}>Create Task</Button>
            </div>
          )}
        </div>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4 max-w-[360px] text-center">
            <ListTodo className="size-12 text-muted-foreground" />
            <div>
              <h2 className="text-[20px] font-semibold">No tasks yet</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Add your first task to this project to get started.
              </p>
            </div>
            {canEdit && (
              <div className="flex flex-col gap-2 items-center">
                <Button onClick={() => setCreateOpen(true)}>Create Task</Button>
                <Button
                  variant="outline"
                  onClick={() => setGenerateOpen(true)}
                  disabled={!canGenerate}
                >
                  <Sparkles className="size-4 mr-1" />
                  Generate with AI
                </Button>
              </div>
            )}
          </div>
        </div>
        <GenerateTasksModal
          open={generateOpen}
          onOpenChange={setGenerateOpen}
          onSubmit={handleGenerateSubmit}
          isProcessing={aiGeneration.isLoading}
          step={aiGeneration.step}
          error={aiGeneration.error}
          displayLines={aiGeneration.displayLines}
          rawText={aiGeneration.rawText}
          onCancel={() => { aiGeneration.cancel(); setGenerateOpen(false); }}
          onRetry={() => { aiGeneration.retry(); }}
        />

        {wizardOpen && aiGeneration.tasks.length > 0 && (
          <TaskGenerationWizard
            open={wizardOpen}
            onOpenChange={(open) => {
              setWizardOpen(open);
              if (!open) aiGeneration.reset();
            }}
            tasks={aiGeneration.tasks}
            projectId={projectId}
            onComplete={() => {
              setWizardOpen(false);
              aiGeneration.reset();
            }}
          />
        )}
        <CreateTaskDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          projectId={projectId}
          members={members}
          sprints={sprints}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Backlog</h1>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setGenerateOpen(true)}
              disabled={!canGenerate}
              title={!canGenerate ? 'Configure AI settings and clone repository first' : 'Generate tasks with AI'}
            >
              <Sparkles className="size-4 mr-1" />
              Generate with AI
            </Button>
            <Button onClick={() => setCreateOpen(true)}>Create Task</Button>
          </div>
        )}
      </div>

      <Tabs
        value={backlogView}
        onValueChange={(v) => setBacklogView(v as 'table' | 'board')}
        className="flex flex-col flex-1 min-h-0"
      >
        <TabsList>
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="board">Board</TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-4">
          <TasksTable
            tasks={taskList}
            projectId={projectId}
            projectPrefix={projectPrefix}
            members={members}
            sprints={sprints}
            onRowSelectionChange={setSelectedTasks}
          />
        </TabsContent>

        <TabsContent value="board" className="mt-4 flex-1 min-h-0">
          <KanbanBoard tasks={taskList} projectId={projectId} projectPrefix={projectPrefix} />
        </TabsContent>
      </Tabs>

      {/* Bulk action bar */}
      {selectedTasks.length > 0 && backlogView === 'table' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <BulkActionBar
            count={selectedTasks.length}
            sprints={sprints}
            onMoveToSprint={handleBulkMoveToSprint}
            onDelete={handleBulkDelete}
            onClear={() => setSelectedTasks([])}
          />
        </div>
      )}

      <CreateTaskDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        projectId={projectId}
        members={members}
        sprints={sprints}
      />

      <GenerateTasksModal
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        onSubmit={handleGenerateSubmit}
        isProcessing={aiGeneration.isLoading}
        step={aiGeneration.step}
        displayLines={aiGeneration.displayLines}
        rawText={aiGeneration.rawText}
      />

      {wizardOpen && aiGeneration.tasks.length > 0 && (
        <TaskGenerationWizard
          open={wizardOpen}
          onOpenChange={(open) => {
            setWizardOpen(open);
            if (!open) aiGeneration.reset();
          }}
          tasks={aiGeneration.tasks}
          projectId={projectId}
          onComplete={() => {
            setWizardOpen(false);
            aiGeneration.reset();
          }}
        />
      )}
    </div>
  );
}
