import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
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
import type { Priority, Sprint, SprintStatus, Task } from '@/lib/types';

const PRIORITY_CONFIG: Record<Priority, { color: string; label: string }> = {
  LOW:      { color: '#6b7280', label: 'Low' },
  MEDIUM:   { color: '#3b82f6', label: 'Medium' },
  HIGH:     { color: '#f59e0b', label: 'High' },
  CRITICAL: { color: '#ef4444', label: 'Critical' },
  BLOCKER:  { color: '#7c3aed', label: 'Blocker' },
};

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
  projectPrefix: string;
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
  projectId: _projectId,
  projectPrefix,
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
                  onClick={() => navigate(`/projects/${projectPrefix}/sprints/${sprint.id}`)}
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

      {/* Expandable task mini table */}
      {expanded && (
        <div className="rounded-lg border bg-card px-4 pb-3 pt-1 rounded-t-none border-t-0">
          {sortedTasks.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3 text-center">
              No tasks in this sprint
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground border-b">
                  <th className="text-left font-medium py-2 pr-3 w-[90px]">Key</th>
                  <th className="text-left font-medium py-2 pr-3">Title</th>
                  <th className="text-left font-medium py-2 pr-3 w-[120px]">Status</th>
                  <th className="text-left font-medium py-2 pr-3 w-[90px]">Priority</th>
                  <th className="text-left font-medium py-2 pr-3 w-[140px]">Assignee</th>
                  <th className="text-right font-medium py-2 w-[40px]">SP</th>
                </tr>
              </thead>
              <tbody>
                {sortedTasks.map((task) => {
                  const isClosed = task.workflowStatus?.isClosed === true;
                  const priority = task.priority ? PRIORITY_CONFIG[task.priority] : null;
                  return (
                    <tr
                      key={task.id}
                      className={cn(
                        'border-b last:border-b-0 cursor-pointer hover:bg-muted/40 transition-colors h-9',
                        isClosed && 'opacity-60',
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/projects/${projectPrefix}/tasks/${task.taskKey ?? task.id}`);
                      }}
                    >
                      {/* Key */}
                      <td className="py-1.5 pr-3">
                        <span className="font-mono text-xs text-muted-foreground">
                          {task.taskKey ?? '—'}
                        </span>
                      </td>

                      {/* Title */}
                      <td className="py-1.5 pr-3 max-w-0">
                        <span
                          className={cn(
                            'truncate block',
                            isClosed && 'line-through text-muted-foreground',
                          )}
                        >
                          {task.title}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-1.5 pr-3">
                        {task.workflowStatus ? (
                          <Badge
                            variant="outline"
                            className="text-xs h-5 px-1.5 font-normal"
                            style={{
                              borderColor: task.workflowStatus.color ?? undefined,
                              color: task.workflowStatus.color ?? undefined,
                            }}
                          >
                            {task.workflowStatus.name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="py-1.5 pr-3">
                        {priority ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className="inline-block size-2 rounded-full shrink-0"
                              style={{ backgroundColor: priority.color }}
                            />
                            <span className="text-xs">{priority.label}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Assignee */}
                      <td className="py-1.5 pr-3">
                        {task.assignee ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <Avatar className="size-5 shrink-0 text-[10px] font-medium">
                              {task.assignee.imageUrl && (
                                <AvatarImage src={task.assignee.imageUrl} alt={task.assignee.name ?? task.assignee.username} />
                              )}
                              <AvatarFallback className="bg-primary/10 text-primary text-[10px]">
                                {(task.assignee.name ?? task.assignee.username).charAt(0).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs truncate">
                              {task.assignee.name ?? task.assignee.username}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      {/* Story Points */}
                      <td className="py-1.5 text-right">
                        {task.storyPoints != null && task.storyPoints > 0 ? (
                          <Badge variant="outline" className="text-xs h-5 px-1.5">
                            {task.storyPoints}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
