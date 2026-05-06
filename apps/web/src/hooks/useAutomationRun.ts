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

export function useAutomationRun(testCaseId: string) {
  const socket = useSocket();
  const queryClient = useQueryClient();

  const [runId, setRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<AutomationRunStatus | 'idle'>('idle');
  const [frame, setFrame] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
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
    setRunId(null);
    setStatus('idle');
    setFrame(null);
    setLogs([]);
    setError(null);
    setDuration(null);
    setElapsed(0);
    stopTimer();
  }, [stopTimer]);

  // WebSocket listeners
  useEffect(() => {
    if (!socket || !runId) return;

    const onFrame = (data: { runId: string; data: string }) => {
      if (data.runId === runId) setFrame(data.data);
    };

    const onLog = (data: { runId: string; level: string; message: string; timestamp: number }) => {
      if (data.runId === runId) {
        setLogs((prev) => [...prev, { level: data.level, message: data.message, timestamp: data.timestamp }]);
      }
    };

    const onStatus = (data: { runId: string; status: AutomationRunStatus; duration?: number }) => {
      if (data.runId === runId) {
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
      if (data.runId === runId) setError(data.message);
    };

    socket.on('automation:frame', onFrame);
    socket.on('automation:log', onLog);
    socket.on('automation:status', onStatus);
    socket.on('automation:error', onError);

    return () => {
      socket.off('automation:frame', onFrame);
      socket.off('automation:log', onLog);
      socket.off('automation:status', onStatus);
      socket.off('automation:error', onError);
    };
  }, [socket, runId, stopTimer, queryClient, testCaseId]);

  // Trigger run mutation
  const triggerRun = useMutation({
    mutationFn: () => api.triggerAutomationRun(testCaseId),
    onSuccess: (run) => {
      setRunId(run.id);
      setStatus('RUNNING');
      setLogs([]);
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
      if (!runId) throw new Error('No active run');
      return api.cancelAutomationRun(runId);
    },
    onSuccess: () => {
      setStatus('CANCELLED');
      stopTimer();
      toast.info('Run cancelled');
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
    error,
    duration,
    elapsed,
    isRunning,
    triggerRun,
    cancelRun,
    reset,
  };
}
