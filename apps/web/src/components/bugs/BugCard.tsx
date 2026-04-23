import { useNavigate, useParams } from 'react-router-dom';
import { formatMinutes } from '../../lib/time-utils';
import type { Bug } from '../../lib/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

const severityConfig: Record<string, { label: string; className: string }> = {
  CRITICAL: { label: 'Critical', className: 'bg-red-500/15 text-red-500' },
  HIGH: { label: 'High', className: 'bg-orange-500/15 text-orange-500' },
  MEDIUM: { label: 'Medium', className: 'bg-yellow-500/15 text-yellow-600' },
  LOW: { label: 'Low', className: 'bg-green-500/15 text-green-600' },
};

interface BugCardProps {
  bug: Bug;
}

export function BugCard({ bug }: BugCardProps) {
  const navigate = useNavigate();
  const { projectPrefix } = useParams<{ projectPrefix: string }>();

  const sev = severityConfig[bug.severity] ?? { label: bug.severity, className: 'bg-muted text-muted-foreground' };

  // Aggregate time from linked bugTasks (same logic as BugTimeTrackingCard)
  let totalEstimated = 0;
  let totalLogged = 0;
  for (const bt of bug.bugTasks ?? []) {
    const task = bt.task;
    const children = task.children ?? [];
    if (children.length > 0) {
      for (const child of children) {
        totalEstimated += child.estimatedMinutes ?? 0;
        totalLogged += (child.timeLogs ?? []).reduce((s, tl) => s + tl.minutes, 0);
      }
    } else {
      totalEstimated += task.estimatedMinutes ?? 0;
      totalLogged += (task.timeLogs ?? []).reduce((s, tl) => s + tl.minutes, 0);
    }
  }
  const hasTime = totalEstimated > 0 || totalLogged > 0;
  const progressPercent = totalEstimated > 0 ? Math.min((totalLogged / totalEstimated) * 100, 100) : 0;
  const isOverBudget = totalEstimated > 0 && totalLogged > totalEstimated;

  return (
    <div
      onClick={() => navigate(`/projects/${projectPrefix}/bugs/${bug.bugKey}`)}
      className="border border-border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs text-muted-foreground font-mono shrink-0">{bug.bugKey}</span>
            <span className="text-sm font-medium truncate min-w-0 flex-1">{bug.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            {bug.assignee && (
              <span className="flex items-center gap-1.5">
                <Avatar className="size-4 shrink-0">
                  {bug.assignee.imageUrl && (
                    <AvatarImage
                      src={bug.assignee.imageUrl}
                      alt={bug.assignee.name ?? bug.assignee.username}
                    />
                  )}
                  <AvatarFallback className="text-[8px]">
                    {getInitials(bug.assignee.name ?? bug.assignee.username ?? '')}
                  </AvatarFallback>
                </Avatar>
                <span>{bug.assignee.name ?? bug.assignee.username}</span>
              </span>
            )}
            {bug.workflowStatus && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{
                  backgroundColor: `${bug.workflowStatus.color}20`,
                  color: bug.workflowStatus.color,
                }}
              >
                {bug.workflowStatus.name}
              </span>
            )}
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 ${sev.className}`}>
              {sev.label}
            </span>
          </div>
        </div>

        {hasTime && (
          <div className="text-right shrink-0">
            <div className={`text-xs ${isOverBudget ? 'text-red-500' : 'text-muted-foreground'}`}>
              {formatMinutes(totalLogged)} / {formatMinutes(totalEstimated)}
            </div>
            <div className="w-20 h-1 bg-muted rounded-full mt-1">
              <div
                className={`h-1 rounded-full ${isOverBudget ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
