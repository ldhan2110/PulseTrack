import { useState, useEffect, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useSocket } from '../socket/useSocket';

type WikiGenerationStep =
  | 'idle'
  | 'queued'
  | 'pulling'
  | 'building-graph'
  | string
  | 'writing-meta'
  | 'completed'
  | 'failed';

export function useWikiGeneration(projectId: string) {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [step, setStep] = useState<WikiGenerationStep>('idle');
  const [streamText, setStreamText] = useState('');

  const isActive = !!jobId && step !== 'idle' && step !== 'completed' && step !== 'failed';

  const generate = useMutation({
    mutationFn: (section?: string) => api.triggerWikiGeneration(projectId, section),
    onSuccess: (data) => {
      setJobId(data.jobId);
      setStep('queued');
      setStreamText('');
      toast.success('Wiki generation started');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start wiki generation');
    },
  });

  // Polling fallback: check job status every 5s while in-progress
  useQuery({
    queryKey: ['wiki-generation-status', projectId, jobId],
    queryFn: () => api.getWikiGenerationStatus(projectId, jobId!),
    enabled: isActive,
    refetchInterval: 5_000,
    select: (data) => {
      if (data.step) setStep(data.step);
      if (data.streamText) setStreamText(data.streamText);
      if (data.status === 'completed') {
        setStep('completed');
        void queryClient.invalidateQueries({ queryKey: ['wikiPages', projectId] });
        void queryClient.invalidateQueries({ queryKey: ['wikiConfig', projectId] });
      }
      if (data.status === 'failed') setStep('failed');
      return data;
    },
  });

  // Socket.IO listeners
  useEffect(() => {
    if (!socket || !jobId) return;

    const onProgress = (data: { jobId: string; step: string }) => {
      if (data.jobId === jobId) setStep(data.step);
    };
    const onStream = (data: { jobId: string; text: string }) => {
      if (data.jobId === jobId) setStreamText(data.text);
    };
    const onCompleted = (data: { jobId: string }) => {
      if (data.jobId === jobId) {
        setStep('completed');
        void queryClient.invalidateQueries({ queryKey: ['wikiPages', projectId] });
        void queryClient.invalidateQueries({ queryKey: ['wikiConfig', projectId] });
        toast.success('Wiki generation completed');
      }
    };
    const onFailed = (data: { jobId: string; error: string }) => {
      if (data.jobId === jobId) {
        setStep('failed');
        toast.error(data.error || 'Wiki generation failed');
      }
    };

    socket.on('wiki-generation:progress', onProgress);
    socket.on('wiki-generation:stream', onStream);
    socket.on('wiki-generation:completed', onCompleted);
    socket.on('wiki-generation:failed', onFailed);

    return () => {
      socket.off('wiki-generation:progress', onProgress);
      socket.off('wiki-generation:stream', onStream);
      socket.off('wiki-generation:completed', onCompleted);
      socket.off('wiki-generation:failed', onFailed);
    };
  }, [socket, jobId, projectId, queryClient]);

  const reset = useCallback(() => {
    setJobId(null);
    setStep('idle');
    setStreamText('');
  }, []);

  return { generate, step, streamText, isActive, reset };
}
