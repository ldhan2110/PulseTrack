import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, GitBranch, CheckCircle2, XCircle, Loader2, Clock, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useAiBugFixes, useDeleteAiBugFix } from '@/hooks/useAiBugFix';
import { useRepositoryConfig } from '@/hooks/useRepositoryConfig';
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

const STATUS_ICON: Record<string, typeof CheckCircle2> = {
  completed: CheckCircle2,
  failed: XCircle,
  queued: Clock,
  preparing: Loader2,
  fixing: Loader2,
  pushing: Loader2,
};

const DELETABLE_STATUSES = ['completed', 'failed', 'cancelled'];
const IN_PROGRESS_STATUSES = ['preparing', 'fixing', 'pushing', 'queued'];

function buildBranchUrl(repoUrl: string, provider: string, branchName: string): string {
  const base = repoUrl.replace(/\.git$/, '');
  if (provider === 'gitlab') return `${base}/-/tree/${branchName}`;
  return `${base}/tree/${branchName}`;
}

export function AiFixHistory({ projectId, bugId }: AiFixHistoryProps) {
  const { data: fixes, isLoading } = useAiBugFixes(projectId, bugId);
  const deleteMutation = useDeleteAiBugFix(projectId);
  const { data: repoConfig } = useRepositoryConfig(projectId);

  if (isLoading || !fixes || fixes.length === 0) return null;

  return (
    <div className="space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        AI Fix Attempts
      </span>
      <div className="space-y-2">
        {fixes.map((fix: AiBugFix) => {
          const StatusIcon = STATUS_ICON[fix.status];
          const isActive = IN_PROGRESS_STATUSES.includes(fix.status);
          const branchUrl = fix.branchName && repoConfig?.repoUrl
            ? buildBranchUrl(repoConfig.repoUrl, repoConfig.provider, fix.branchName)
            : null;

          return (
            <div
              key={fix.id}
              className={`rounded-lg border p-3 text-sm transition-colors ${
                isActive ? 'border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30' : ''
              }`}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {StatusIcon && (
                    <StatusIcon className={`h-3.5 w-3.5 ${
                      fix.status === 'completed' ? 'text-green-500' :
                      fix.status === 'failed' ? 'text-red-500' :
                      isActive ? 'text-blue-500 animate-spin' : 'text-muted-foreground'
                    }`} />
                  )}
                  <span className="font-medium">Attempt {fix.attempt}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge variant={STATUS_VARIANT[fix.status] ?? 'secondary'} className="text-[10px] px-1.5 py-0">
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

              {/* Root cause */}
              {fix.rootCause && (
                <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {fix.rootCause}
                </p>
              )}

              {/* Branch link */}
              {fix.branchName && (
                <div className="mt-2 flex items-center gap-1.5">
                  <GitBranch className="h-3 w-3 text-muted-foreground shrink-0" />
                  {branchUrl ? (
                    <a
                      href={branchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-mono text-blue-500 hover:underline truncate max-w-[200px] inline-flex items-center gap-1"
                    >
                      {fix.branchName}
                      <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                    </a>
                  ) : (
                    <code className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">
                      {fix.branchName}
                    </code>
                  )}
                </div>
              )}

              {/* Footer: time + error */}
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(fix.createdAt), { addSuffix: true })}
                </span>
              </div>
              {fix.errorMessage && (
                <p className="mt-1 text-[11px] text-red-500 dark:text-red-400 line-clamp-1 bg-red-50 dark:bg-red-950/30 rounded px-1.5 py-0.5">
                  {fix.errorMessage}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
