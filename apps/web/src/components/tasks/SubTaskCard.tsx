import { useNavigate, useParams } from 'react-router-dom';
import { formatMinutes } from '../../lib/time-utils';
import type { Task } from '../../lib/types';

interface SubTaskCardProps {
  subTask: Task;
}

export function SubTaskCard({ subTask }: SubTaskCardProps) {
  const navigate = useNavigate();
  const { projectPrefix } = useParams<{ projectPrefix: string }>();

  const estimated = subTask.estimatedMinutes ?? 0;
  const logged = subTask.timeLogs?.reduce((s, tl) => s + tl.minutes, 0) ?? 0;
  const progressPercent = estimated > 0 ? Math.min((logged / estimated) * 100, 100) : 0;
  const isOverBudget = estimated > 0 && logged > estimated;

  return (
    <div
      onClick={() => navigate(`/projects/${projectPrefix}/tasks/${subTask.taskKey}`)}
      className="border border-border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-mono">{subTask.taskKey}</span>
            <span className="text-sm font-medium truncate">{subTask.title}</span>
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            {subTask.assignee && <span>👤 {subTask.assignee.username}</span>}
            {subTask.workflowStatus && (
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                style={{
                  backgroundColor: `${subTask.workflowStatus.color}20`,
                  color: subTask.workflowStatus.color,
                }}
              >
                {subTask.workflowStatus.name}
              </span>
            )}
          </div>
        </div>

        {estimated > 0 && (
          <div className="text-right shrink-0">
            <div className={`text-xs ${isOverBudget ? 'text-red-500' : 'text-muted-foreground'}`}>
              {formatMinutes(logged)} / {formatMinutes(estimated)}
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
