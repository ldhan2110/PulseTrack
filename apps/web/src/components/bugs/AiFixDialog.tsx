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
import { Loader2, ExternalLink, XCircle, CheckCircle2 } from 'lucide-react';
import { useStartAiBugFix, useCancelAiBugFix, useAiBugFixProgress, useAiBugFixes } from '@/hooks/useAiBugFix';
import type { AiBugFix } from '@/lib/types';

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
  'creating-mr': 'Creating merge request...',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
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
            AI will analyze the bug, fix the code, and create a merge request.
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
                        <Badge variant={fix.status === 'completed' ? 'default' : 'destructive'}>
                          {fix.status}
                        </Badge>
                        {fix.prUrl && (
                          <a href={fix.prUrl} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline text-xs flex items-center gap-1">
                            MR <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
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
                  {progress.result.prUrl && (
                    <a
                      href={progress.result.prUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-500 hover:underline font-medium"
                    >
                      Open Merge Request <ExternalLink className="h-3 w-3" />
                    </a>
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
