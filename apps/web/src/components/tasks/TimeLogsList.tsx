import { Trash2, Clock, Pencil } from 'lucide-react';
import { formatMinutes } from '../../lib/time-utils';
import type { TimeLog } from '../../lib/types';

interface TimeLogsListProps {
  timeLogs: TimeLog[];
  currentUserId: string;
  canDeleteAny?: boolean;
  onDelete: (timeLogId: string) => void;
  onEdit?: (timeLog: TimeLog) => void;
  isDeleting?: boolean;
}

export function TimeLogsList({ timeLogs, currentUserId, canDeleteAny, onDelete, onEdit, isDeleting }: TimeLogsListProps) {
  const totalMinutes = timeLogs.reduce((sum, tl) => sum + tl.minutes, 0);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Time Logs ({timeLogs.length})
        </h3>
        {totalMinutes > 0 && (
          <span className="text-xs text-muted-foreground">
            Total: {formatMinutes(totalMinutes)}
          </span>
        )}
      </div>

      {timeLogs.length === 0 ? (
        <p className="text-sm text-muted-foreground">No time logged yet</p>
      ) : (
        <div className="space-y-1">
          {timeLogs.map((tl) => (
            <div
              key={tl.id}
              className="flex items-start justify-between gap-2 py-2 px-2 rounded-md hover:bg-muted/50 group text-sm"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium">{tl.user?.name ?? tl.user?.username ?? 'Unknown'}</span>
                  <span className="text-muted-foreground">·</span>
                  <span className="text-muted-foreground">
                    {new Date(tl.loggedAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                  <span className="text-muted-foreground">·</span>
                  <span className="font-semibold">{formatMinutes(tl.minutes)}</span>
                </div>
                {tl.comment && (
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{tl.comment}</p>
                )}
              </div>
              {(tl.userId === currentUserId || canDeleteAny) && (
                <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  {onEdit && (
                    <button
                      onClick={() => onEdit(tl)}
                      aria-label="Edit time log"
                      className="text-muted-foreground hover:text-foreground p-1"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => onDelete(tl.id)}
                    disabled={isDeleting}
                    aria-label="Delete time log"
                    className="text-muted-foreground hover:text-red-500 p-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
