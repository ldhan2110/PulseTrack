import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAiBugFixes } from '@/hooks/useAiBugFix';
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
  'creating-mr': 'secondary',
};

export function AiFixHistory({ projectId, bugId }: AiFixHistoryProps) {
  const { data: fixes, isLoading } = useAiBugFixes(projectId, bugId);

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
              <Badge variant={STATUS_VARIANT[fix.status] ?? 'secondary'}>
                {fix.status}
              </Badge>
            </div>
            {fix.rootCause && (
              <p className="text-xs text-muted-foreground line-clamp-2">{fix.rootCause}</p>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatDistanceToNow(new Date(fix.createdAt), { addSuffix: true })}</span>
              {fix.prUrl && (
                <a
                  href={fix.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:underline flex items-center gap-1"
                >
                  MR #{fix.prNumber} <ExternalLink className="h-3 w-3" />
                </a>
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
