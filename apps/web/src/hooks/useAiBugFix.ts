import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useSocket } from '../socket/useSocket';
import type { AiBugFixStatus } from '../lib/types';

export function useAiBugFixes(projectId: string, bugId: string) {
  return useQuery({
    queryKey: ['ai-bug-fixes', projectId, bugId],
    queryFn: () => api.getAiBugFixes(projectId, bugId),
    enabled: !!projectId && !!bugId,
  });
}

export function useStartAiBugFix(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bugId, data }: { bugId: string; data: { targetBranch: string; guidance?: string; includeTests?: boolean } }) =>
      api.startAiBugFix(projectId, bugId, data),
    onSuccess: (_data, { bugId }) => {
      void queryClient.invalidateQueries({ queryKey: ['ai-bug-fixes', projectId, bugId] });
      toast.info('AI bug fix started');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useCancelAiBugFix(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bugId, fixId }: { bugId: string; fixId: string }) =>
      api.cancelAiBugFix(projectId, bugId, fixId),
    onSuccess: (_data, { bugId }) => {
      void queryClient.invalidateQueries({ queryKey: ['ai-bug-fixes', projectId, bugId] });
      toast.info('AI fix cancelled');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useAiBugFixProgress(fixId: string | null) {
  const socket = useSocket();
  const [step, setStep] = useState<AiBugFixStatus | 'idle'>('idle');
  const [logText, setLogText] = useState('');
  const [result, setResult] = useState<{
    prUrl?: string;
    prNumber?: number;
    rootCause?: string | null;
    solution?: string | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!socket || !fixId) return;

    const onProgress = (data: { fixId: string; step: AiBugFixStatus }) => {
      if (data.fixId === fixId) setStep(data.step);
    };

    const onStream = (data: { fixId: string; text: string }) => {
      if (data.fixId === fixId) setLogText(data.text);
    };

    const onCompleted = (data: { fixId: string; prUrl: string; prNumber: number; rootCause: string | null; solution: string | null }) => {
      if (data.fixId === fixId) {
        setStep('completed');
        setResult({ prUrl: data.prUrl, prNumber: data.prNumber, rootCause: data.rootCause, solution: data.solution });
        toast.success('AI fix completed — MR created');
      }
    };

    const onFailed = (data: { fixId: string; error: string }) => {
      if (data.fixId === fixId) {
        setStep('failed');
        setError(data.error);
        toast.error(`AI fix failed: ${data.error}`);
      }
    };

    socket.on('ai-bug-fix:progress', onProgress);
    socket.on('ai-bug-fix:stream', onStream);
    socket.on('ai-bug-fix:completed', onCompleted);
    socket.on('ai-bug-fix:failed', onFailed);

    return () => {
      socket.off('ai-bug-fix:progress', onProgress);
      socket.off('ai-bug-fix:stream', onStream);
      socket.off('ai-bug-fix:completed', onCompleted);
      socket.off('ai-bug-fix:failed', onFailed);
    };
  }, [socket, fixId]);

  const reset = useCallback(() => {
    setStep('idle');
    setLogText('');
    setResult(null);
    setError(null);
  }, []);

  return {
    step,
    logText,
    result,
    error,
    isActive: !!fixId && !['idle', 'completed', 'failed', 'cancelled'].includes(step),
    isCompleted: step === 'completed',
    isFailed: step === 'failed',
    reset,
  };
}
