import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, XCircle, CheckCircle2, GitBranch, ExternalLink } from 'lucide-react';
import { useStartAiBugFix, useCancelAiBugFix, useAiBugFixProgress, useAiBugFixes } from '@/hooks/useAiBugFix';
import { useRepositoryConfig } from '@/hooks/useRepositoryConfig';
import type { AiBugFix } from '@/lib/types';

function buildBranchUrl(repoUrl: string, provider: string, branchName: string): string {
  const base = repoUrl.replace(/\.git$/, '');
  if (provider === 'gitlab') return `${base}/-/tree/${branchName}`;
  return `${base}/tree/${branchName}`;
}

interface AiFixDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  bugId: string;
  remoteBranches: string[];
  branchesLoading: boolean;
}

const STEP_LABELS: Record<string, string> = {
  queued: 'Queued...',
  preparing: 'Preparing worktree...',
  fixing: 'AI is analyzing and fixing the bug...',
  pushing: 'Pushing changes...',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const STATUS_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'default',
  failed: 'destructive',
  cancelled: 'outline',
  queued: 'secondary',
  preparing: 'secondary',
  fixing: 'secondary',
  pushing: 'secondary',
};

export function AiFixDialog({
  open,
  onOpenChange,
  projectId,
  bugId,
  remoteBranches,
  branchesLoading,
}: AiFixDialogProps) {
  const [targetBranch, setTargetBranch] = useState('');
  const [guidance, setGuidance] = useState('');
  const [includeTests, setIncludeTests] = useState(true);
  const [activeFixId, setActiveFixId] = useState<string | null>(null);
  const logRef = useRef<HTMLPreElement>(null);

  const startFix = useStartAiBugFix(projectId);
  const cancelFix = useCancelAiBugFix(projectId);
  const progress = useAiBugFixProgress(activeFixId);
  const { data: previousFixes } = useAiBugFixes(projectId, bugId);
  const { data: repoConfig } = useRepositoryConfig(projectId);

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [progress.logText]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setActiveFixId(null);
      setGuidance('');
      progress.reset();
    }
  }, [open]);

  const handleSubmit = () => {
    if (!targetBranch) return;
    startFix.mutate(
      { bugId, data: { targetBranch, guidance: guidance || undefined, includeTests } },
      {
        onSuccess: (data) => {
          setActiveFixId(data.fixId);
        },
      },
    );
  };

  const handleCancel = () => {
    if (activeFixId) {
      cancelFix.mutate({ bugId, fixId: activeFixId });
    }
  };

  const isInProgress = !!activeFixId && progress.isActive;
  const isCompleted = progress.isCompleted;
  const isFailed = progress.isFailed;
  const showForm = !activeFixId || (!isInProgress && !isCompleted && !isFailed);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl flex flex-col overflow-hidden max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>AI Bug Fix</DialogTitle>
          <DialogDescription>
            AI will analyze the bug, fix the code, and push to a new branch.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {showForm && (
            <>
              {/* Previous attempts */}
              {previousFixes && previousFixes.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Previous Attempts
                  </Label>
                  <div className="space-y-1 max-h-32 overflow-y-auto rounded border p-2 text-sm">
                    {previousFixes.map((fix: AiBugFix) => (
                      <div key={fix.id} className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground">Attempt {fix.attempt}</span>
                        <Badge variant={STATUS_VARIANT[fix.status] ?? 'secondary'}>
                          {fix.status}
                        </Badge>
                        {fix.branchName && repoConfig?.repoUrl ? (
                          <a
                            href={buildBranchUrl(repoConfig.repoUrl, repoConfig.provider, fix.branchName)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-mono text-blue-500 hover:underline truncate max-w-[160px] inline-flex items-center gap-0.5"
                          >
                            <GitBranch className="h-2.5 w-2.5 shrink-0" />
                            {fix.branchName}
                          </a>
                        ) : fix.branchName ? (
                          <code className="text-xs font-mono text-muted-foreground truncate max-w-[160px]">
                            {fix.branchName}
                          </code>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Target branch */}
              <div className="space-y-2">
                <Label>Target Branch</Label>
                <Select value={targetBranch} onValueChange={setTargetBranch}>
                  <SelectTrigger>
                    <SelectValue placeholder={branchesLoading ? 'Loading branches...' : 'Select target branch'} />
                  </SelectTrigger>
                  <SelectContent>
                    {remoteBranches.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Include test cases */}
              <div className="flex items-center justify-between">
                <Label htmlFor="include-tests">Include linked test cases</Label>
                <Switch id="include-tests" checked={includeTests} onCheckedChange={setIncludeTests} />
              </div>

              {/* Guidance */}
              <div className="space-y-2">
                <Label>Additional Guidance (optional)</Label>
                <Textarea
                  value={guidance}
                  onChange={(e) => setGuidance(e.target.value)}
                  placeholder="e.g. Issue is in the auth middleware, check token expiry logic"
                  rows={3}
                />
              </div>
            </>
          )}

          {/* Progress view */}
          {(isInProgress || isCompleted || isFailed) && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                {isInProgress && <Loader2 className="h-4 w-4 animate-spin" />}
                {isCompleted && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                {isFailed && <XCircle className="h-4 w-4 text-red-500" />}
                <span className="text-sm font-medium">
                  {STEP_LABELS[progress.step] ?? progress.step}
                </span>
              </div>

              {/* Terminal output */}
              <pre
                ref={logRef}
                className="rounded bg-zinc-950 p-3 text-xs text-zinc-300 font-mono overflow-auto max-h-64 whitespace-pre-wrap"
              >
                {progress.logText || 'Waiting for output...'}
              </pre>

              {/* Completion result */}
              {isCompleted && progress.result && (
                <div className="space-y-2 rounded border p-3 text-sm">
                  {progress.result.rootCause && (
                    <div>
                      <span className="font-semibold">Root Cause:</span> {progress.result.rootCause}
                    </div>
                  )}
                  {progress.result.solution && (
                    <div>
                      <span className="font-semibold">Solution:</span> {progress.result.solution}
                    </div>
                  )}
                  {progress.result.branchName && (
                    <div className="flex items-center gap-1.5">
                      <GitBranch className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      {repoConfig?.repoUrl ? (
                        <a
                          href={buildBranchUrl(repoConfig.repoUrl, repoConfig.provider, progress.result.branchName)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-mono text-blue-500 hover:underline inline-flex items-center gap-1"
                        >
                          {progress.result.branchName}
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      ) : (
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{progress.result.branchName}</code>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {isFailed && progress.error && (
                <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
                  {progress.error}
                </div>
              )}
            </div>
          )}
        </DialogBody>

        <DialogFooter>
          {showForm && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button
                onClick={handleSubmit}
                disabled={!targetBranch || startFix.isPending}
              >
                {startFix.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Start AI Fix
              </Button>
            </>
          )}
          {isInProgress && (
            <Button variant="destructive" onClick={handleCancel} disabled={cancelFix.isPending}>
              {cancelFix.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cancel Fix
            </Button>
          )}
          {(isCompleted || isFailed) && (
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
