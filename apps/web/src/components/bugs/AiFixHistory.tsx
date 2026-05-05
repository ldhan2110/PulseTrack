import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAiBugFixes, useDeleteAiBugFix } from '@/hooks/useAiBugFix';
import type { AiBugFix } from '@/lib/types';

interface AiFixHistoryProps {
  projectId: string;
  bugId: string;
}

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'default',
  failed: 'destructive',
  cancelled: 'outline',
  queued: 'secondary',
  preparing: 'secondary',
  fixing: 'secondary',
  pushing: 'secondary',
};

const DELETABLE_STATUSES = ['completed', 'failed', 'cancelled'];

export function AiFixHistory({ projectId, bugId }: AiFixHistoryProps) {
  const { data: fixes, isLoading } = useAiBugFixes(projectId, bugId);
  const deleteMutation = useDeleteAiBugFix(projectId);

  if (isLoading || !fixes || fixes.length === 0) return null;

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        AI Fix Attempts
      </span>
      <div className="space-y-2">
        {fixes.map((fix: AiBugFix) => (
          <div key={fix.id} className="rounded border p-2 text-sm space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-medium">Attempt {fix.attempt}</span>
              <div className="flex items-center gap-1">
                <Badge variant={STATUS_VARIANT[fix.status] ?? 'secondary'}>
                  {fix.status}
                </Badge>
                {DELETABLE_STATUSES.includes(fix.status) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate({ bugId, fixId: fix.id })}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
            </div>
            {fix.rootCause && (
              <p className="text-xs text-muted-foreground line-clamp-2">{fix.rootCause}</p>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatDistanceToNow(new Date(fix.createdAt), { addSuffix: true })}</span>
              {fix.branchName && (
                <code className="font-mono truncate max-w-[160px]">{fix.branchName}</code>
              )}
            </div>
            {fix.errorMessage && (
              <p className="text-xs text-red-500 line-clamp-1">{fix.errorMessage}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
