// apps/web/src/hooks/useAiTaskGeneration.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useSocket } from '../socket/useSocket';
import type {
  AiGenerationStep,
} from '../lib/types';

export function useAiTaskGeneration(projectId: string) {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [step, setStep] = useState<AiGenerationStep | 'idle' | 'queued' | 'completed' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [displayLines, setDisplayLines] = useState<string[]>([]);
  const [rawText, setRawText] = useState<string>('');
  const isActive = !!jobId && step !== 'idle' && step !== 'completed' && step !== 'failed';
  const lastFormDataRef = useRef<FormData | null>(null);

  // Submit generation request
  const generate = useMutation({
    mutationFn: (formData: FormData) => {
      lastFormDataRef.current = formData;
      return api.generateTasks(projectId, formData);
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
      setStep('queued');
      setErrorMessage(null);
      toast.info('AI task generation started');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start generation');
    },
  });

  // Poll job result when completed (fetch tasks)
  const jobResult = useQuery({
    queryKey: ['ai-generation', projectId, jobId],
    queryFn: () => api.getGenerationJobResult(projectId, jobId!),
    enabled: !!jobId && step === 'completed',
  });

  // Polling fallback: check job status every 5s while in-progress
  const jobStatus = useQuery({
    queryKey: ['ai-generation-status', projectId, jobId],
    queryFn: () => api.getGenerationJobResult(projectId, jobId!),
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
      if (data.step) setStep(data.step);
      if (data.displayLines) setDisplayLines(data.displayLines);
      if (data.rawText) setRawText(data.rawText);
      // Legacy fallback for streamText field
      if (!data.rawText && data.streamText) setRawText(data.streamText);
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

    const onCompleted = (data: { jobId: string; taskCount: number }) => {
      if (data.jobId === jobId) {
        setStep('completed');
        toast.success(`Generated ${data.taskCount} tasks`);
      }
    };

    const onFailed = (data: { jobId: string; error: string }) => {
      if (data.jobId === jobId) {
        setStep('failed');
        setErrorMessage(data.error);
        toast.error(`Generation failed: ${data.error}`);
      }
    };

    const onStream = (data: { jobId: string; displayLines?: string[]; rawText?: string; text?: string }) => {
      if (data.jobId === jobId) {
        if (data.displayLines) setDisplayLines(data.displayLines);
        if (data.rawText) setRawText(data.rawText);
        // Legacy fallback
        if (!data.rawText && data.text) setRawText(data.text);
      }
    };

    socket.on('ai-generation:progress', onProgress);
    socket.on('ai-generation:completed', onCompleted);
    socket.on('ai-generation:failed', onFailed);
    socket.on('ai-generation:stream', onStream);

    return () => {
      socket.off('ai-generation:progress', onProgress);
      socket.off('ai-generation:completed', onCompleted);
      socket.off('ai-generation:failed', onFailed);
      socket.off('ai-generation:stream', onStream);
    };
  }, [socket, jobId]);

  const reset = useCallback(() => {
    setJobId(null);
    setStep('idle');
    setErrorMessage(null);
    setDisplayLines([]);
    setRawText('');
    void queryClient.removeQueries({ queryKey: ['ai-generation', projectId] });
    void queryClient.removeQueries({ queryKey: ['ai-generation-status', projectId] });
  }, [projectId, queryClient]);

  const cancel = useCallback(() => {
    reset();
  }, [reset]);

  const retry = useCallback(() => {
    reset();
  }, [reset]);

  return {
    generate,
    jobId,
    step,
    displayLines,
    rawText,
    tasks: jobResult.data?.tasks ?? [],
    isLoading: generate.isPending || isActive,
    isCompleted: step === 'completed',
    isFailed: step === 'failed',
    error: errorMessage ?? jobResult.data?.error ?? null,
    reset,
    cancel,
    retry,
  };
}
