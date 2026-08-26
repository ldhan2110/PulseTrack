import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { useSocket } from '@/socket/useSocket';

export function useTestAutomation(testCaseId: string) {
  return useQuery({
    queryKey: ['test-automation', testCaseId],
    queryFn: () => api.getAutomation(testCaseId),
    enabled: !!testCaseId,
  });
}

export function useUpsertAutomation(testCaseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { script: string; timeoutMs?: number }) =>
      api.upsertAutomation(testCaseId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-automation', testCaseId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useGenerateScript(testCaseId: string, projectId: string) {
  const queryClient = useQueryClient();
  const socket = useSocket();
  // Deterministic server jobId — lets us reattach after a reload / page change.
  const jobId = `script-${testCaseId}`;
  const [isActive, setIsActive] = useState(false);
  const [step, setStep] = useState<string>('');

  const finish = (msg?: () => void) => {
    setIsActive(false);
    setStep('');
    void queryClient.invalidateQueries({ queryKey: ['test-automation', testCaseId] });
    msg?.();
  };

  const generate = useMutation({
    mutationFn: () => api.generateAutomationScript(testCaseId),
    onSuccess: () => {
      setIsActive(true);
      setStep('Starting…');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Reattach on mount: if a job is already running for this test case, resume tracking.
  useEffect(() => {
    let cancelled = false;
    api
      .getScriptJob(testCaseId, jobId)
      .then((r) => {
        if (cancelled) return;
        if (r.status === 'active' || r.status === 'waiting') {
          setIsActive(true);
          setStep(r.step ?? 'Working…');
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [testCaseId, jobId]);

  // Socket stream + terminal events.
  useEffect(() => {
    if (!socket) return;
    socket.emit('join-project', projectId);
    const onProgress = (d: { jobId: string; step?: string }) => {
      if (d.jobId === jobId && d.step) setStep(d.step);
    };
    const onCompleted = (d: { jobId: string }) => {
      if (d.jobId === jobId) finish(() => toast.success('Script generated'));
    };
    const onFailed = (d: { jobId: string; error: string }) => {
      if (d.jobId === jobId) finish(() => toast.error(d.error || 'Generation failed'));
    };
    socket.on('testcase-script:progress', onProgress);
    socket.on('testcase-script:completed', onCompleted);
    socket.on('testcase-script:failed', onFailed);
    return () => {
      socket.off('testcase-script:progress', onProgress);
      socket.off('testcase-script:completed', onCompleted);
      socket.off('testcase-script:failed', onFailed);
    };
  }, [socket, jobId, projectId]);

  // Poll fallback for missed socket events while active. removeOnComplete/Fail
  // means a finished job reports as gone, so poll only quietly stops the spinner
  // and refetches the saved script — it never guesses the outcome.
  useQuery({
    queryKey: ['script-job-status', testCaseId, jobId],
    queryFn: async () => {
      const r = await api.getScriptJob(testCaseId, jobId);
      if (r.status === 'active' || r.status === 'waiting') {
        if (r.step) setStep(r.step);
      } else {
        finish();
      }
      return r;
    },
    enabled: isActive,
    refetchInterval: 5_000,
  });

  return { generate, isActive, step };
}

export function useDeleteAutomation(testCaseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.deleteAutomation(testCaseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['test-automation', testCaseId] });
      toast.success('Automation script deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
