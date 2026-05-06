import { useState, useCallback } from 'react';
import type { AiGenerationStep, GeneratedTestCase } from '@/lib/types';

type GenerationStep = AiGenerationStep | 'idle' | 'queued' | 'completed' | 'failed';

// TODO: implement
export function useAiTestCaseGeneration(_projectId: string) {
  const [state] = useState({
    isLoading: false,
    isCompleted: false,
    step: 'idle' as GenerationStep,
    error: null as string | null,
    rawText: '',
    testCases: [] as GeneratedTestCase[],
  });

  const generate = {
    mutate: (_data: FormData) => {
      // TODO: implement
    },
  };

  const cancel = useCallback(() => {
    // TODO: implement
  }, []);

  const retry = useCallback(() => {
    // TODO: implement
  }, []);

  const reset = useCallback(() => {
    // TODO: implement
  }, []);

  return {
    ...state,
    generate,
    cancel,
    retry,
    reset,
  };
}
