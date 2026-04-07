import { useEffect } from 'react';
import { CheckSquare } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useMyTasks } from '@/hooks/useMyTasks';
import { useUiStore } from '@/store/uiStore';
import { MyTasksBoard } from '@/components/tasks/MyTasksBoard';

export function MyTasksPage() {
  const { data: tasks, isLoading } = useMyTasks();
  const setFullWidth = useUiStore((s) => s.setFullWidth);

  useEffect(() => {
    setFullWidth(true);
    return () => setFullWidth(false);
  }, [setFullWidth]);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-7 w-32" />
        <div className="flex gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2 flex-1">
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

  const taskList = tasks ?? [];

  if (taskList.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-xl font-semibold tracking-tight">My Tasks</h1>
        <div className="flex items-center justify-center py-24">
          <div className="flex flex-col items-center gap-4 max-w-[360px] text-center">
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
    <div className="flex flex-col gap-4 h-full min-h-0">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">My Tasks</h1>
        <p className="text-sm text-muted-foreground">
          {taskList.length} task{taskList.length !== 1 ? 's' : ''} across {projectCount} project{projectCount !== 1 ? 's' : ''}
        </p>
      </div>
      <div className="flex-1 min-h-0">
        <MyTasksBoard tasks={taskList} />
      </div>
    </div>
  );
}
