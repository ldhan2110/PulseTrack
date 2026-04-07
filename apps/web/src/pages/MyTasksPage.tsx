import { CheckSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyTasks } from '@/hooks/useMyTasks';
import { useMyTaskSync } from '@/hooks/useTaskSync';
import { MyTasksTable } from '@/components/tasks/MyTasksTable';

export function MyTasksPage() {
  const { data: tasks, isLoading } = useMyTasks();
  useMyTaskSync();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 px-8 py-6">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  const taskList = tasks ?? [];

  if (taskList.length === 0) {
    return (
      <div className="flex flex-col gap-4 px-8 py-6">
        <h1 className="text-xl font-semibold tracking-tight">My Tasks</h1>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4 max-w-90 text-center">
            <CheckSquare className="size-12 text-muted-foreground" />
            <div>
              <h2 className="text-[20px] font-semibold">No tasks assigned to you</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Tasks assigned to you across all projects will appear here.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const projectCount = new Set(taskList.map((t) => t.projectId)).size;

  return (
    <div className="flex flex-col gap-4 px-8 py-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">My Tasks</h1>
        <p className="text-sm text-muted-foreground">
          {taskList.length} task{taskList.length !== 1 ? 's' : ''} across {projectCount} project{projectCount !== 1 ? 's' : ''}
        </p>
      </div>
      <MyTasksTable tasks={taskList} />
    </div>
  );
}
