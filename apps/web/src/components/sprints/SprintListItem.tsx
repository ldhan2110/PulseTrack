import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { Sprint, SprintStatus, Task } from '@/lib/types';

function getStatusVariant(status: SprintStatus): 'default' | 'outline' | 'secondary' {
  switch (status) {
    case 'ACTIVE':
      return 'default';
    case 'PLANNED':
      return 'outline';
    case 'COMPLETED':
      return 'secondary';
    default:
      return 'outline';
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch {
    return dateStr;
  }
}

interface SprintListItemProps {
  sprint: Sprint;
  isActive: boolean;
  canManage: boolean;
  onActivate: () => void;
  onClose: () => void;
  projectId: string;
  sprintTasks: Task[];
  completedCount: number;
  totalCount: number;
}

export function SprintListItem({
  sprint,
  isActive,
  canManage,
  onActivate,
  onClose,
  projectId,
  sprintTasks,
  completedCount,
  totalCount,
}: SprintListItemProps) {
  const navigate = useNavigate();
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isCompleted = sprint.status === 'COMPLETED';
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const incompleteCount = totalCount - completedCount;

  const sortedTasks = useMemo(() => {
    const open = sprintTasks.filter((t) => !t.workflowStatus?.isClosed);
    const closed = sprintTasks.filter((t) => t.workflowStatus?.isClosed === true);
    return [...open, ...closed];
  }, [sprintTasks]);

  const handleRowClick = () => {
    setExpanded((prev) => !prev);
  };

  return (
    <>
      <div
        className={cn(
          'rounded-lg border bg-card p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/30 transition-colors',
          isActive && 'border-l-4 border-l-primary',
          isCompleted && 'opacity-60',
          expanded && 'rounded-b-none border-b-0',
        )}
        onClick={handleRowClick}
      >
        {/* Sprint name + status */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                'text-sm font-semibold truncate',
                isCompleted && 'text-muted-foreground',
              )}
            >
              {sprint.name}
            </span>
            <Badge variant={getStatusVariant(sprint.status)} className="shrink-0 text-xs">
              {sprint.status === 'COMPLETED' ? 'Completed' : sprint.status === 'ACTIVE' ? 'Active' : 'Planned'}
            </Badge>
          </div>
          <span className="text-xs text-muted-foreground">
            {formatDate(sprint.startDate)} — {formatDate(sprint.endDate)}
          </span>
        </div>

        {/* Task progress */}
        <div className="shrink-0 flex items-center gap-3 min-w-[140px]">
          <span className="text-sm text-muted-foreground whitespace-nowrap">
            {completedCount}/{totalCount} tasks
          </span>
          {totalCount > 0 && (
            <Progress value={progressPercent} className="h-1.5 w-20" />
          )}
        </div>

        {/* Expand chevron */}
        <div className="shrink-0 text-muted-foreground">
          {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </div>

        {/* Actions */}
        {canManage && !isCompleted && (
          <div className="shrink-0 flex gap-2" onClick={(e) => e.stopPropagation()}>
            {sprint.status === 'PLANNED' && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={onActivate}
              >
                Activate
              </Button>
            )}
            {sprint.status === 'ACTIVE' && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => navigate(`/projects/${projectId}/sprints/${sprint.id}`)}
                >
                  View Board
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setCloseDialogOpen(true)}
                >
                  Close Sprint
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      {/* Expandable task list */}
      {expanded && (
        <div className="rounded-lg border bg-card px-4 pb-3 pt-1 rounded-t-none border-t-0">
          {sortedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">
              No tasks in this sprint
            </p>
          ) : (
            <div className="flex flex-col divide-y">
              {sortedTasks.map((task) => {
                const isClosed = task.workflowStatus?.isClosed === true;
                return (
                  <div
                    key={task.id}
                    className="flex items-center gap-3 py-2 min-h-[36px]"
                  >
                    {/* Status icon */}
                    {isClosed ? (
                      <CheckCircle2 className="size-4 shrink-0 text-green-600" />
                    ) : (
                      <Circle className="size-4 shrink-0 text-muted-foreground" />
                    )}

                    {/* Task title */}
                    <span
                      className={cn(
                        'text-sm truncate flex-1 min-w-0',
                        isClosed && 'line-through text-muted-foreground',
                      )}
                    >
                      {task.title}
                    </span>

                    {/* Assignee avatar */}
                    {task.assignee ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="size-6 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
                            {task.assignee.username.charAt(0).toUpperCase()}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>{task.assignee.username}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <div className="size-6 shrink-0" />
                    )}

                    {/* Story points */}
                    {task.storyPoints != null && task.storyPoints > 0 && (
                      <Badge variant="outline" className="shrink-0 text-xs h-5 px-1.5">
                        {task.storyPoints}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Close Sprint Confirmation Dialog */}
      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Sprint</AlertDialogTitle>
            <AlertDialogDescription>
              {incompleteCount > 0
                ? `${incompleteCount} incomplete task${incompleteCount !== 1 ? 's' : ''} will be moved back to the backlog. This cannot be undone.`
                : 'All tasks in this sprint are complete. This cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setCloseDialogOpen(false);
                onClose();
              }}
            >
              Close Sprint
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
