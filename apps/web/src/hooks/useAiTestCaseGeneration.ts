// apps/web/src/hooks/useAiTestCaseGeneration.ts
import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useSocket } from '../socket/useSocket';
import type { AiGenerationStep } from '../lib/types';

export function useAiTestCaseGeneration(projectId: string) {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [step, setStep] = useState<AiGenerationStep | 'idle' | 'queued' | 'completed' | 'failed'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [displayLines, setDisplayLines] = useState<string[]>([]);
  const [rawText, setRawText] = useState<string>('');
  const isActive = !!jobId && step !== 'idle' && step !== 'completed' && step !== 'failed';
  const lastFormDataRef = useRef<FormData | null>(null);

  const generate = useMutation({
    mutationFn: (formData: FormData) => {
      lastFormDataRef.current = formData;
      return api.generateTestCases(projectId, formData);
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
      setStep('queued');
      setErrorMessage(null);
      toast.info('AI test case generation started');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start generation');
    },
  });

  const jobResult = useQuery({
    queryKey: ['ai-testcase-generation', projectId, jobId],
    queryFn: () => api.getTestCaseGenerationJobResult(projectId, jobId!),
    enabled: !!jobId && step === 'completed',
  });

  const jobStatus = useQuery({
    queryKey: ['ai-testcase-generation-status', projectId, jobId],
    queryFn: () => api.getTestCaseGenerationJobResult(projectId, jobId!),
    enabled: isActive,
    refetchInterval: 5_000,
  });

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
      if (!data.streamText) return;
      setRawText(data.streamText);
    }
  }, [jobStatus.data]);

  useEffect(() => {
    if (!socket || !jobId) return;

    const onProgress = (data: { jobId: string; step: AiGenerationStep }) => {
      if (data.jobId === jobId) {
        setStep(data.step);
      }
    };

    const onCompleted = (data: { jobId: string; testCaseCount: number }) => {
      if (data.jobId === jobId) {
        setStep('completed');
        toast.success(`Generated ${data.testCaseCount} test cases`);
      }
    };

    const onFailed = (data: { jobId: string; error: string }) => {
      if (data.jobId === jobId) {
        setStep('failed');
        setErrorMessage(data.error);
        toast.error(`Generation failed: ${data.error}`);
      }
    };

    const onStream = (data: { jobId: string; text?: string }) => {
      if (data.jobId === jobId) {
        if (data.text) setRawText(data.text);
      }
    };

    socket.on('ai-testcase-generation:progress', onProgress);
    socket.on('ai-testcase-generation:completed', onCompleted);
    socket.on('ai-testcase-generation:failed', onFailed);
    socket.on('ai-testcase-generation:stream', onStream);

    return () => {
      socket.off('ai-testcase-generation:progress', onProgress);
      socket.off('ai-testcase-generation:completed', onCompleted);
      socket.off('ai-testcase-generation:failed', onFailed);
      socket.off('ai-testcase-generation:stream', onStream);
    };
  }, [socket, jobId]);

  const reset = useCallback(() => {
    setJobId(null);
    setStep('idle');
    setErrorMessage(null);
    setDisplayLines([]);
    setRawText('');
    void queryClient.removeQueries({ queryKey: ['ai-testcase-generation', projectId] });
    void queryClient.removeQueries({ queryKey: ['ai-testcase-generation-status', projectId] });
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
    testCases: jobResult.data?.testCases ?? [],
    isLoading: generate.isPending || isActive,
    isCompleted: step === 'completed',
    isFailed: step === 'failed',
    error: errorMessage ?? jobResult.data?.error ?? null,
    reset,
    cancel,
    retry,
  };
}
