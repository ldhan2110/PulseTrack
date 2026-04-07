// apps/web/src/hooks/useAiTaskGeneration.ts
import { useState, useEffect, useCallback } from 'react';
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

  // Submit generation request
  const generate = useMutation({
    mutationFn: (formData: FormData) => api.generateTasks(projectId, formData),
    onSuccess: (data) => {
      setJobId(data.jobId);
      setStep('queued');
      toast.info('AI task generation started');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start generation');
    },
  });

  // Poll job result when completed
  const jobResult = useQuery({
    queryKey: ['ai-generation', projectId, jobId],
    queryFn: () => api.getGenerationJobResult(projectId, jobId!),
    enabled: !!jobId && step === 'completed',
  });

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
        toast.error(`Generation failed: ${data.error}`);
      }
    };

    socket.on('ai-generation:progress', onProgress);
    socket.on('ai-generation:completed', onCompleted);
    socket.on('ai-generation:failed', onFailed);

    return () => {
      socket.off('ai-generation:progress', onProgress);
      socket.off('ai-generation:completed', onCompleted);
      socket.off('ai-generation:failed', onFailed);
    };
  }, [socket, jobId]);

  const reset = useCallback(() => {
    setJobId(null);
    setStep('idle');
    void queryClient.removeQueries({ queryKey: ['ai-generation', projectId] });
  }, [projectId, queryClient]);

  return {
    generate,
    jobId,
    step,
    tasks: jobResult.data?.tasks ?? [],
    isLoading: generate.isPending || (step !== 'idle' && step !== 'completed' && step !== 'failed'),
    isCompleted: step === 'completed',
    isFailed: step === 'failed',
    error: jobResult.data?.error,
    reset,
  };
}
