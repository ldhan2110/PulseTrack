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
  | 'generating-sections'
  | string
  | 'writing-meta'
  | 'completed'
  | 'failed';

export interface SectionProgress {
  section: string;
  status: 'pending' | 'generating' | 'done' | 'error';
  agent?: string;
  pagesGenerated?: number;
  error?: string;
}

export function useWikiGeneration(projectId: string) {
  const socket = useSocket();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [step, setStep] = useState<WikiGenerationStep>('idle');
  const [streamText, setStreamText] = useState('');
  const [sectionProgress, setSectionProgress] = useState<SectionProgress[]>([]);

  const isActive = !!jobId && step !== 'idle' && step !== 'completed' && step !== 'failed';

  const completedSections = sectionProgress.filter((s) => s.status === 'done').length;
  const totalSections = sectionProgress.length;

  const generate = useMutation({
    mutationFn: (section?: string) => api.triggerWikiGeneration(projectId, section),
    onSuccess: (data) => {
      setJobId(data.jobId);
      setStep('queued');
      setStreamText('');
      setSectionProgress([]);
      toast.success('Wiki generation started');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start wiki generation');
    },
  });

  // Polling fallback: check job status every 5s while in-progress
  const { data: statusData } = useQuery({
    queryKey: ['wiki-generation-status', projectId, jobId],
    queryFn: () => api.getWikiGenerationStatus(projectId, jobId!),
    enabled: isActive,
    refetchInterval: 5_000,
  });

  useEffect(() => {
    if (!statusData) return;
    if (statusData.step) setStep(statusData.step);
    if (statusData.streamText) setStreamText(statusData.streamText);
    if (statusData.status === 'completed') {
      setStep('completed');
      void queryClient.invalidateQueries({ queryKey: ['wikiPages', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['wikiConfig', projectId] });
    }
    if (statusData.status === 'failed') setStep('failed');
  }, [statusData, projectId, queryClient]);

  // Socket.IO listeners
  useEffect(() => {
    if (!socket || !jobId) return;

    const onProgress = (data: { jobId: string; step: string }) => {
      if (data.jobId === jobId) setStep(data.step);
    };
    const onStream = (data: { jobId: string; text: string }) => {
      if (data.jobId === jobId) setStreamText(data.text);
    };

    const onSectionStart = (data: { jobId: string; section: string; agent: string }) => {
      if (data.jobId !== jobId) return;
      setSectionProgress((prev) => {
        const exists = prev.find((s) => s.section === data.section);
        if (exists) {
          return prev.map((s) =>
            s.section === data.section ? { ...s, status: 'generating' as const, agent: data.agent } : s,
          );
        }
        return [...prev, { section: data.section, status: 'generating' as const, agent: data.agent }];
      });
    };

    const onSectionComplete = (data: {
      jobId: string;
      section: string;
      pagesGenerated: number;
      error?: string;
    }) => {
      if (data.jobId !== jobId) return;
      setSectionProgress((prev) =>
        prev.map((s) =>
          s.section === data.section
            ? {
                ...s,
                status: data.error ? ('error' as const) : ('done' as const),
                pagesGenerated: data.pagesGenerated,
                error: data.error,
              }
            : s,
        ),
      );
      // Refresh wiki tree as each section lands
      if (!data.error) {
        void queryClient.invalidateQueries({ queryKey: ['wikiPages', projectId] });
      }
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
    socket.on('wiki-generation:section-start', onSectionStart);
    socket.on('wiki-generation:section-complete', onSectionComplete);
    socket.on('wiki-generation:completed', onCompleted);
    socket.on('wiki-generation:failed', onFailed);

    return () => {
      socket.off('wiki-generation:progress', onProgress);
      socket.off('wiki-generation:stream', onStream);
      socket.off('wiki-generation:section-start', onSectionStart);
      socket.off('wiki-generation:section-complete', onSectionComplete);
      socket.off('wiki-generation:completed', onCompleted);
      socket.off('wiki-generation:failed', onFailed);
    };
  }, [socket, jobId, projectId, queryClient]);

  const reset = useCallback(() => {
    setJobId(null);
    setStep('idle');
    setStreamText('');
    setSectionProgress([]);
  }, []);

  return {
    generate,
    step,
    streamText,
    isActive,
    reset,
    sectionProgress,
    completedSections,
    totalSections,
  };
}
