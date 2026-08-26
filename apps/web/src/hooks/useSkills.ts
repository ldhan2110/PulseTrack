import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { CreateSkillPayload, UpdateSkillPayload } from '../lib/types';

export function useSkills(projectId: string) {
  return useQuery({
    queryKey: ['skills', projectId],
    queryFn: () => api.getSkills(projectId),
    enabled: !!projectId,
  });
}

export function useCreateSkill(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateSkillPayload) => api.createSkill(projectId, data),
    onSuccess: () => {
      toast.success('Skill created');
      return queryClient.invalidateQueries({ queryKey: ['skills', projectId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create skill');
    },
  });
}

export function useUpdateSkill(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ skillId, data }: { skillId: string; data: UpdateSkillPayload }) =>
      api.updateSkill(projectId, skillId, data),
    onSuccess: () => {
      return queryClient.invalidateQueries({ queryKey: ['skills', projectId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update skill');
    },
  });
}

export function useDeleteSkill(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (skillId: string) => api.deleteSkill(projectId, skillId),
    onSuccess: () => {
      toast.success('Skill deleted');
      return queryClient.invalidateQueries({ queryKey: ['skills', projectId] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete skill');
    },
  });
}
