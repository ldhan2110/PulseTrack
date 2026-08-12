import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { api } from '@/lib/api';
import { useTestAutomation } from '@/hooks/useTestAutomation';
import { cn } from '@/lib/utils';
import type { AutomationRun, TestExecutionAttachment } from '@/lib/types';

interface AutomationRunViewProps {
  testCaseId: string;
  projectId: string;
  /** Attachments of the current execution case (holds the captured snapshot). */
  attachments?: TestExecutionAttachment[];
}

const STATUS_META: Record<string, { label: string; className: string; icon: 'ok' | 'fail' | 'run' }> = {
  RUNNING: { label: 'Running…', className: 'text-yellow-500', icon: 'run' },
  PASSED: { label: 'Passed', className: 'text-green-500', icon: 'ok' },
  FAILED: { label: 'Failed', className: 'text-red-500', icon: 'fail' },
  TIMEOUT: { label: 'Timed out', className: 'text-red-500', icon: 'fail' },
  CANCELLED: { label: 'Cancelled', className: 'text-muted-foreground', icon: 'fail' },
};

/** Read-only view of the persisted automation run: script + logs/error text. */
export function AutomationRunView({ testCaseId, projectId, attachments = [] }: AutomationRunViewProps) {
  const { data: automation } = useTestAutomation(testCaseId);
  const queryClient = useQueryClient();

  const { data: runs = [] } = useQuery({
    queryKey: ['test-automation-runs', testCaseId],
    queryFn: () => api.getAutomationRuns(testCaseId),
    enabled: !!testCaseId,
    // Poll while the latest run is still executing (server-side auto-run)
    refetchInterval: (query) =>
      (query.state.data as AutomationRun[] | undefined)?.[0]?.status === 'RUNNING' ? 3000 : false,
  });

  const latest = runs[0];
  const meta = latest ? STATUS_META[latest.status] ?? STATUS_META.RUNNING : null;

  // Snapshot lives on the execution-case (parent) query; refetch it when the run
  // leaves RUNNING so the freshly-captured screenshot appears without a reload.
  const prevStatus = useRef(latest?.status);
  useEffect(() => {
    if (prevStatus.current === 'RUNNING' && latest?.status && latest.status !== 'RUNNING') {
      void queryClient.invalidateQueries({ queryKey: ['test-execution-key', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['test-execution', projectId] });
    }
    prevStatus.current = latest?.status;
  }, [latest?.status, projectId, queryClient]);

  // The captured snapshot is the most recent image attachment (pass-*/failure-*).
  const snapshot = [...attachments]
    .filter((a) => a.mimeType.startsWith('image/'))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];

  // The download endpoint is JWT-guarded, so a bare <img src> 401s (no auth
  // header). Fetch the blob with the token and render via object URL.
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!snapshot) {
      setSnapshotUrl(null);
      return;
    }
    let url: string | null = null;
    let cancelled = false;
    api
      .downloadExecutionEvidence(projectId, snapshot.id)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSnapshotUrl(url);
      })
      .catch(() => setSnapshotUrl(null));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [snapshot, projectId]);

  return (
    <div className="flex flex-col h-full">
      {/* Status bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 border-b text-xs">
        {meta?.icon === 'ok' && <CheckCircle2 className="size-3.5 text-green-500" />}
        {meta?.icon === 'fail' && <XCircle className="size-3.5 text-red-500" />}
        {meta?.icon === 'run' && <Loader2 className="size-3.5 animate-spin text-yellow-500" />}
        <span className={cn('font-medium', meta?.className ?? 'text-muted-foreground')}>
          {meta?.label ?? 'Not run'}
        </span>
        {latest?.duration != null && (
          <span className="text-muted-foreground">{(latest.duration / 1000).toFixed(1)}s</span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        {/* Script */}
        <div className="px-3 py-2 border-b">
          <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Script</div>
          <div className="text-[11px] [&_pre]:m-0 [&_pre]:rounded [&_pre]:p-2 [&_pre]:overflow-auto [&_code]:font-mono">
            <ReactMarkdown rehypePlugins={[rehypeHighlight]}>
              {'```javascript\n' + (automation?.script ?? '// No script') + '\n```'}
            </ReactMarkdown>
          </div>
        </div>

        {/* Error */}
        {latest?.error && (
          <div className="px-3 py-2 border-b">
            <div className="text-[10px] font-semibold text-red-500 uppercase tracking-wide mb-1">Error</div>
            <pre className="text-[11px] font-mono whitespace-pre-wrap break-words text-red-600 dark:text-red-400">
              {latest.error}
            </pre>
          </div>
        )}

        {/* Snapshot */}
        {snapshot && snapshotUrl && (
          <div className="px-3 py-2 border-b">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Snapshot</div>
            <a href={snapshotUrl} target="_blank" rel="noopener noreferrer">
              <img src={snapshotUrl} alt={snapshot.filename} className="max-w-full rounded border" />
            </a>
          </div>
        )}

        {/* Steps */}
        {latest?.logs?.steps && latest.logs.steps.length > 0 && (
          <div className="px-3 py-2 border-b">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Steps</div>
            <div className="text-[11px] font-mono space-y-0.5">
              {latest.logs.steps.map((s, i) => (
                <div key={i} className="flex items-baseline gap-2 whitespace-pre-wrap break-words">
                  <span className={s.status === 'failed' ? 'text-red-500' : 'text-green-500'}>
                    {s.status === 'failed' ? '✗' : '✓'}
                  </span>
                  <span className="flex-1">{s.name}</span>
                  <span className="text-muted-foreground">{s.duration}ms</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Logs */}
        {latest?.logs?.messages && latest.logs.messages.length > 0 && (
          <div className="px-3 py-2">
            <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Logs</div>
            <div className="text-[11px] font-mono space-y-0.5">
              {latest.logs.messages.map((l, i) => (
                <div key={i} className="whitespace-pre-wrap break-words">
                  <span className="text-muted-foreground">[{l.level}]</span> {l.message}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
