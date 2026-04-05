import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import type { Sprint, SprintStatus } from '@/lib/types';

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
  incompleteTasks?: number;
}

export function SprintListItem({
  sprint,
  isActive,
  canManage,
  onActivate,
  onClose,
  projectId,
  incompleteTasks = 0,
}: SprintListItemProps) {
  const navigate = useNavigate();
  const [closeDialogOpen, setCloseDialogOpen] = useState(false);
  const isCompleted = sprint.status === 'COMPLETED';

  const handleRowClick = () => {
    if (isActive) {
      navigate(`/projects/${projectId}/sprints/${sprint.id}`);
    }
  };

  return (
    <>
      <div
        className={cn(
          'rounded-lg border bg-card p-4 flex items-center gap-4',
          isActive && 'border-l-4 border-l-primary',
          isCompleted && 'opacity-60',
          isActive && 'cursor-pointer hover:bg-muted/30 transition-colors',
        )}
        onClick={isActive ? handleRowClick : undefined}
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

        {/* Task count */}
        <div className="text-sm text-muted-foreground shrink-0 w-20 text-right">
          {sprint._count?.tasks ?? 0} tasks
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
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setCloseDialogOpen(true)}
              >
                Close Sprint
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Close Sprint Confirmation Dialog */}
      <AlertDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close Sprint</AlertDialogTitle>
            <AlertDialogDescription>
              {incompleteTasks > 0
                ? `${incompleteTasks} incomplete task${incompleteTasks !== 1 ? 's' : ''} will be moved back to the backlog. This cannot be undone.`
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
