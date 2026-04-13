import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type {
  CreatePlannerSessionPayload,
  UpdatePlannerSessionPayload,
  CreateScopePayload,
  UpdateScopePayload,
  CreateFeaturePayload,
  UpdateFeaturePayload,
} from '../lib/types';

// ─── Sessions ─────────────────────────────────────────────────────────────────

export function usePlannerSessions(projectId: string) {
  return useQuery({
    queryKey: ['planner-sessions', projectId],
    queryFn: () => api.getPlannerSessions(projectId),
    enabled: !!projectId,
  });
}

export function usePlannerSession(projectId: string, sessionId: string) {
  return useQuery({
    queryKey: ['planner-session', projectId, sessionId],
    queryFn: () => api.getPlannerSession(projectId, sessionId),
    enabled: !!projectId && !!sessionId,
  });
}

export function useCreatePlannerSession(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePlannerSessionPayload) => api.createPlannerSession(projectId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planner-sessions', projectId] });
      toast.success('Session created');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUpdatePlannerSession(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sessionId, data }: { sessionId: string; data: UpdatePlannerSessionPayload }) =>
      api.updatePlannerSession(projectId, sessionId, data),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({ queryKey: ['planner-sessions', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['planner-session', projectId, variables.sessionId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useDeletePlannerSession(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => api.deletePlannerSession(projectId, sessionId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planner-sessions', projectId] });
      toast.success('Session deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export function usePlannerMessages(sessionId: string) {
  return useQuery({
    queryKey: ['planner-messages', sessionId],
    queryFn: () => api.getPlannerMessages(sessionId),
    enabled: !!sessionId,
  });
}

export function useSendPlannerMessage(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ content, files }: { content: string; files?: File[] }) =>
      api.sendPlannerMessage(sessionId, content, files),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planner-messages', sessionId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// ─── Scopes ───────────────────────────────────────────────────────────────────

export function usePlannerScopes(sessionId: string) {
  return useQuery({
    queryKey: ['planner-scopes', sessionId],
    queryFn: () => api.getPlannerScopes(sessionId),
    enabled: !!sessionId,
  });
}

export function useCreatePlannerScope(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateScopePayload) => api.createPlannerScope(sessionId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planner-scopes', sessionId] });
      toast.success('Scope added');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUpdatePlannerScope(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scopeId, data }: { scopeId: string; data: UpdateScopePayload }) =>
      api.updatePlannerScope(sessionId, scopeId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planner-scopes', sessionId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useDeletePlannerScope(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (scopeId: string) => api.deletePlannerScope(sessionId, scopeId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planner-scopes', sessionId] });
      toast.success('Scope deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useReorderPlannerScopes(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => api.reorderPlannerScopes(sessionId, orderedIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planner-scopes', sessionId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

// ─── Features ─────────────────────────────────────────────────────────────────

export function useCreatePlannerFeature(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scopeId, data }: { scopeId: string; data: CreateFeaturePayload }) =>
      api.createPlannerFeature(sessionId, scopeId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planner-scopes', sessionId] });
      toast.success('Feature added');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useUpdatePlannerFeature(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      scopeId,
      featureId,
      data,
    }: {
      scopeId: string;
      featureId: string;
      data: UpdateFeaturePayload;
    }) => api.updatePlannerFeature(sessionId, scopeId, featureId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planner-scopes', sessionId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useDeletePlannerFeature(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scopeId, featureId }: { scopeId: string; featureId: string }) =>
      api.deletePlannerFeature(sessionId, scopeId, featureId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planner-scopes', sessionId] });
      toast.success('Feature deleted');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useReorderPlannerFeatures(sessionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ scopeId, orderedIds }: { scopeId: string; orderedIds: string[] }) =>
      api.reorderPlannerFeatures(sessionId, scopeId, orderedIds),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['planner-scopes', sessionId] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}
