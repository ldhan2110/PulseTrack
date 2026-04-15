// apps/web/src/hooks/useAiWbsGeneration.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useSocket } from '../socket/useSocket';
import type {
  AiGenerationStep,
} from '../lib/types';

export function useAiWbsGeneration(projectId: string) {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [step, setStep] = useState<AiGenerationStep | 'idle' | 'queued' | 'completed' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const isActive = !!jobId && step !== 'idle' && step !== 'completed' && step !== 'failed';
  const lastFormDataRef = useRef<FormData | null>(null);

  // Submit generation request
  const generate = useMutation({
    mutationFn: (formData: FormData) => {
      lastFormDataRef.current = formData;
      return api.generateWbs(projectId, formData);
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
      setStep('queued');
      setErrorMessage(null);
      toast.info('AI WBS generation started');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start generation');
    },
  });

  // Poll job result when completed (fetch phases)
  const jobResult = useQuery({
    queryKey: ['ai-wbs-generation', projectId, jobId],
    queryFn: () => api.getWbsGenerationResult(projectId, jobId!),
    enabled: !!jobId && step === 'completed',
  });

  // Polling fallback: check job status every 5s while in-progress
  const jobStatus = useQuery({
    queryKey: ['ai-wbs-generation-status', projectId, jobId],
    queryFn: () => api.getWbsGenerationResult(projectId, jobId!),
    enabled: isActive,
    refetchInterval: 5_000,
  });

  // Sync poll results into local state (fallback for missed socket events)
  useEffect(() => {
    if (!jobStatus.data) return;
    const data = jobStatus.data;
    if (data.status === 'completed') {
      setStep('completed');
    } else if (data.status === 'failed') {
      setStep('failed');
      setErrorMessage(data.error ?? 'Unknown error');
    } else {
      if (data.step) setStep(data.step as AiGenerationStep);
      if (data.rawText) setRawText(data.rawText);
    }
  }, [jobStatus.data]);

  // Socket.IO listeners
  useEffect(() => {
    if (!socket || !jobId) return;

    const onProgress = (data: { jobId: string; step: AiGenerationStep }) => {
      if (data.jobId === jobId) {
        setStep(data.step);
      }
    };

    const onCompleted = (data: { jobId: string; phaseCount: number; taskCount: number }) => {
      if (data.jobId === jobId) {
        setStep('completed');
        toast.success(`Generated ${data.phaseCount} phases, ${data.taskCount} tasks`);
      }
    };

    const onFailed = (data: { jobId: string; error: string }) => {
      if (data.jobId === jobId) {
        setStep('failed');
        setErrorMessage(data.error);
        toast.error(`Generation failed: ${data.error}`);
      }
    };

    const onStream = (data: { jobId: string; rawText?: string }) => {
      if (data.jobId === jobId) {
        if (data.rawText) setRawText(data.rawText);
      }
    };

    socket.on('ai-wbs-generation:progress', onProgress);
    socket.on('ai-wbs-generation:completed', onCompleted);
    socket.on('ai-wbs-generation:failed', onFailed);
    socket.on('ai-wbs-generation:stream', onStream);

    return () => {
      socket.off('ai-wbs-generation:progress', onProgress);
      socket.off('ai-wbs-generation:completed', onCompleted);
      socket.off('ai-wbs-generation:failed', onFailed);
      socket.off('ai-wbs-generation:stream', onStream);
    };
  }, [socket, jobId]);

  const reset = useCallback(() => {
    setJobId(null);
    setStep('idle');
    setErrorMessage(null);
    setRawText('');
    void queryClient.removeQueries({ queryKey: ['ai-wbs-generation', projectId] });
    void queryClient.removeQueries({ queryKey: ['ai-wbs-generation-status', projectId] });
  }, [projectId, queryClient]);

  return {
    generate,
    jobId,
    step,
    rawText,
    phases: jobResult.data?.phases ?? [],
    isLoading: generate.isPending || isActive,
    isCompleted: step === 'completed',
    isFailed: step === 'failed',
    error: errorMessage ?? jobResult.data?.error ?? null,
    reset,
  };
}
