import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type {
  CreateWbsPhasePayload, UpdateWbsPhasePayload,
  CreateWbsTaskPayload, UpdateWbsTaskPayload,
  CreateWbsSubtaskPayload, UpdateWbsSubtaskPayload,
  CreateWbsDependencyPayload, LinkBacklogPayload,
  BulkCreateWbsPayload,
} from '@/lib/types';

// ─── Queries ───────────────────────────────────────────────

export function useWbsPhases(projectId: string) {
  return useQuery({
    queryKey: ['wbs-phases', projectId],
    queryFn: () => api.getWbsPhases(projectId),
    enabled: !!projectId,
  });
}

export function useWbsDependencies(projectId: string) {
  return useQuery({
    queryKey: ['wbs-dependencies', projectId],
    queryFn: () => api.getWbsDependencies(projectId),
    enabled: !!projectId,
  });
}

// ─── Phase Mutations ───────────────────────────────────────

export function useCreateWbsPhase(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWbsPhasePayload) => api.createWbsPhase(projectId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
      toast.success('Phase created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateWbsPhase(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phaseId, data }: { phaseId: string; data: UpdateWbsPhasePayload }) =>
      api.updateWbsPhase(projectId, phaseId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteWbsPhase(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (phaseId: string) => api.deleteWbsPhase(projectId, phaseId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
      toast.success('Phase deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useReorderWbsPhases(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderedIds: string[]) => api.reorderWbsPhases(projectId, orderedIds),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useBulkCreateWbs(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: BulkCreateWbsPayload) => api.bulkCreateWbs(projectId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
      toast.success('WBS items imported');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Task Mutations ────────────────────────────────────────

export function useCreateWbsTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phaseId, data }: { phaseId: string; data: CreateWbsTaskPayload }) =>
      api.createWbsTask(phaseId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
      toast.success('Task created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateWbsTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phaseId, taskId, data }: { phaseId: string; taskId: string; data: UpdateWbsTaskPayload }) =>
      api.updateWbsTask(phaseId, taskId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteWbsTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phaseId, taskId }: { phaseId: string; taskId: string }) =>
      api.deleteWbsTask(phaseId, taskId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
      toast.success('Task deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Subtask Mutations ─────────────────────────────────────

export function useCreateWbsSubtask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, data }: { taskId: string; data: CreateWbsSubtaskPayload }) =>
      api.createWbsSubtask(taskId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
      toast.success('Subtask created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateWbsSubtask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, subtaskId, data }: { taskId: string; subtaskId: string; data: UpdateWbsSubtaskPayload }) =>
      api.updateWbsSubtask(taskId, subtaskId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteWbsSubtask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, subtaskId }: { taskId: string; subtaskId: string }) =>
      api.deleteWbsSubtask(taskId, subtaskId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
      toast.success('Subtask deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Dependency Mutations ──────────────────────────────────

export function useCreateWbsDependency(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateWbsDependencyPayload) =>
      api.createWbsDependency(projectId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-dependencies', projectId] });
      toast.success('Dependency created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteWbsDependency(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (depId: string) => api.deleteWbsDependency(projectId, depId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-dependencies', projectId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ─── Backlog Link Mutations ────────────────────────────────

export function useLinkWbsBacklog(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nodeType, nodeId, data }: { nodeType: 'task' | 'subtask'; nodeId: string; data: LinkBacklogPayload }) => {
      if (nodeType === 'task') return api.linkWbsTaskBacklog(nodeId, data);
      return api.linkWbsSubtaskBacklog(nodeId, data) as Promise<any>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
      toast.success('Backlog item linked');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUnlinkWbsBacklog(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ nodeType, nodeId }: { nodeType: 'task' | 'subtask'; nodeId: string }) => {
      if (nodeType === 'task') return api.unlinkWbsTaskBacklog(nodeId);
      return api.unlinkWbsSubtaskBacklog(nodeId) as Promise<any>;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['wbs-phases', projectId] });
      toast.success('Backlog item unlinked');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
