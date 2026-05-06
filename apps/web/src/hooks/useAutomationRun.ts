import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useSocket } from '@/socket/useSocket';
import { toast } from 'sonner';
import type { AutomationRunStatus } from '@/lib/types';

interface LogEntry {
  level: string;
  message: string;
  timestamp: number;
}

interface StepEntry {
  name: string;
  type: 'navigation' | 'action' | 'assertion' | 'custom';
  status: 'passed' | 'failed';
  duration: number;
  screenshot: string;
  error?: string;
}

export function useAutomationRun(testCaseId: string) {
  const socket = useSocket();
  const queryClient = useQueryClient();

  const [runId, setRunId] = useState<string | null>(null);
  const runIdRef = useRef<string | null>(null);
  const [status, setStatus] = useState<AutomationRunStatus | 'idle'>('idle');
  const [frame, setFrame] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [steps, setSteps] = useState<StepEntry[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState<number | null>(null);

  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsed(Date.now() - startTimeRef.current);
      }
    }, 100);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    runIdRef.current = null;
    setRunId(null);
    setStatus('idle');
    setFrame(null);
    setLogs([]);
    setSteps([]);
    setError(null);
    setDuration(null);
    setElapsed(0);
    stopTimer();
  }, [stopTimer]);

  // DEBUG: log socket connection state
  useEffect(() => {
    if (!socket) { console.warn('[useAutomationRun] socket is null'); return; }
    console.log('[useAutomationRun] socket.connected=', socket.connected, 'socket.id=', socket.id);
    const debugAll = (event: string, ...args: unknown[]) => {
      if (event.startsWith('automation:')) {
        console.log('[useAutomationRun] received event:', event, 'runIdRef=', runIdRef.current, 'payload runId=', (args[0] as any)?.runId);
      }
    };
    socket.onAny(debugAll);
    socket.on('connect', () => console.log('[useAutomationRun] socket connected, id=', socket.id));
    socket.on('disconnect', (reason) => console.warn('[useAutomationRun] socket disconnected:', reason));
    return () => { socket.offAny(debugAll); };
  }, [socket]);

  // WebSocket listeners — use ref to avoid race condition where events
  // arrive before useEffect re-runs with new runId
  useEffect(() => {
    if (!socket) return;

    const onFrame = (data: { runId: string; data: string }) => {
      if (data.runId === runIdRef.current) setFrame(data.data);
    };

    const onLog = (data: { runId: string; level: string; message: string; timestamp: number }) => {
      if (data.runId === runIdRef.current) {
        setLogs((prev) => [...prev, { level: data.level, message: data.message, timestamp: data.timestamp }]);
      }
    };

    const onStatus = (data: { runId: string; status: AutomationRunStatus; duration?: number }) => {
      if (data.runId === runIdRef.current) {
        setStatus(data.status);
        if (data.duration) setDuration(data.duration);
        if (data.status !== 'RUNNING') {
          stopTimer();
          void queryClient.invalidateQueries({ queryKey: ['test-automation', testCaseId] });
          if (data.status === 'PASSED') toast.success('Test passed');
          if (data.status === 'FAILED') toast.error('Test failed');
          if (data.status === 'TIMEOUT') toast.error('Test timed out');
        }
      }
    };

    const onError = (data: { runId: string; message: string }) => {
      if (data.runId === runIdRef.current) setError(data.message);
    };

    const onStep = (data: { runId: string } & StepEntry) => {
      if (data.runId === runIdRef.current) {
        setSteps((prev) => [...prev, {
          name: data.name,
          type: data.type,
          status: data.status,
          duration: data.duration,
          screenshot: data.screenshot,
          error: data.error,
        }]);
      }
    };

    socket.on('automation:frame', onFrame);
    socket.on('automation:log', onLog);
    socket.on('automation:status', onStatus);
    socket.on('automation:error', onError);
    socket.on('automation:step', onStep);

    return () => {
      socket.off('automation:frame', onFrame);
      socket.off('automation:log', onLog);
      socket.off('automation:status', onStatus);
      socket.off('automation:error', onError);
      socket.off('automation:step', onStep);
    };
  }, [socket, stopTimer, queryClient, testCaseId]);

  // Trigger run mutation
  const triggerRun = useMutation({
    mutationFn: () => api.triggerAutomationRun(testCaseId),
    onSuccess: (run) => {
      runIdRef.current = run.id;
      setRunId(run.id);
      setStatus('RUNNING');
      setLogs([]);
      setSteps([]);
      setError(null);
      setFrame(null);
      startTimer();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  // Cancel run mutation
  const cancelRun = useMutation({
    mutationFn: () => {
      if (!runIdRef.current) throw new Error('No active run');
      return api.cancelAutomationRun(runIdRef.current);
    },
    onSuccess: (result: { cancelled: boolean; status?: string }) => {
      if (result.cancelled) {
        setStatus('CANCELLED');
        toast.info('Run cancelled');
      } else {
        // Run already finished — sync UI to actual status
        setStatus((result.status as AutomationRunStatus) ?? 'FAILED');
        toast.info('Run already completed');
      }
      stopTimer();
      void queryClient.invalidateQueries({ queryKey: ['test-automation', testCaseId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const isRunning = status === 'RUNNING';

  return {
    runId,
    status,
    frame,
    logs,
    steps,
    error,
    duration,
    elapsed,
    isRunning,
    triggerRun,
    cancelRun,
    reset,
  };
}
