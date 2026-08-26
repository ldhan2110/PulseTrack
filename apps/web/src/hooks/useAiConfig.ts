import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useSocket } from '../socket/useSocket';
import type { UpsertAiConfigPayload, UpdateProjectContextPayload } from '../lib/types';

export function useAiConfig(projectId: string) {
  return useQuery({
    queryKey: ['aiConfig', projectId],
    queryFn: () => api.getAiConfig(projectId),
    enabled: !!projectId,
  });
}

export function useUpsertAiConfig(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpsertAiConfigPayload) => api.upsertAiConfig(projectId, data),
    onSuccess: () => {
      toast.success('AI configuration saved');
      return queryClient.invalidateQueries({ queryKey: ['aiConfig', projectId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save AI configuration');
    },
  });
}

export function useUpdateProjectContext(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProjectContextPayload) =>
      api.updateProjectContext(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['aiConfig', projectId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update project context');
    },
  });
}

export function useGenerateProjectContext(projectId: string) {
  const queryClient = useQueryClient();
  const socket = useSocket();
  // Deterministic server jobId — lets us reattach after a reload without any local storage.
  const jobId = `ctx-${projectId}`;
  const [isActive, setIsActive] = useState(false);
  const [step, setStep] = useState<string>('');

  const finish = (msg?: () => void) => {
    setIsActive(false);
    setStep('');
    void queryClient.invalidateQueries({ queryKey: ['aiConfig', projectId] });
    msg?.();
  };

  const generate = useMutation({
    mutationFn: () => api.generateProjectContext(projectId),
    onSuccess: () => {
      setIsActive(true);
      setStep('Starting…');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to generate project context');
    },
  });

  // Reattach on mount: if a job is already running for this project, resume tracking.
  useEffect(() => {
    let cancelled = false;
    api
      .getProjectContextJob(projectId, jobId)
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
  }, [projectId, jobId]);

  // Socket stream + terminal events.
  useEffect(() => {
    if (!socket) return;
    socket.emit('join-project', projectId);
    const onProgress = (d: { jobId: string; step?: string }) => {
      if (d.jobId === jobId && d.step) setStep(d.step);
    };
    const onCompleted = (d: { jobId: string }) => {
      if (d.jobId === jobId) finish(() => toast.success('Project context generated'));
    };
    const onFailed = (d: { jobId: string; error: string }) => {
      if (d.jobId === jobId) finish(() => toast.error(d.error || 'Generation failed'));
    };
    socket.on('project-context:progress', onProgress);
    socket.on('project-context:completed', onCompleted);
    socket.on('project-context:failed', onFailed);
    return () => {
      socket.off('project-context:progress', onProgress);
      socket.off('project-context:completed', onCompleted);
      socket.off('project-context:failed', onFailed);
    };
  }, [socket, projectId, jobId]);

  // Poll fallback for missed socket events while active. Socket events are the
  // source of truth for success/failure toasts; removeOnComplete/Fail means a
  // finished job reports as gone, so poll only quietly stops the spinner and
  // refetches config — it never guesses the outcome.
  useQuery({
    queryKey: ['ai-context-status', projectId, jobId],
    queryFn: async () => {
      const r = await api.getProjectContextJob(projectId, jobId);
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
