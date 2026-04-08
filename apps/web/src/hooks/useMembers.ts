import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { AddMemberPayload, AddMembersPayload, ChangeRolePayload } from '../lib/types';

export function useMembers(projectId: string) {
  return useQuery({
    queryKey: ['members', projectId],
    queryFn: () => api.getMembers(projectId),
    enabled: !!projectId,
  });
}

export function useSearchUsers(projectId: string, query: string) {
  return useQuery({
    queryKey: ['users-search', projectId, query],
    queryFn: () => api.searchUsers(projectId, query),
    enabled: query.length >= 2,
  });
}

export function useAddMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddMemberPayload) => api.addMember(projectId, data),
    onSuccess: (member) => {
      void queryClient.invalidateQueries({ queryKey: ['members', projectId] });
      toast.success(`${member.user.username} added to project`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useAddMembers(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: AddMembersPayload) => api.addMembers(projectId, data),
    onSuccess: (members) => {
      void queryClient.invalidateQueries({ queryKey: ['members', projectId] });
      toast.success(`${members.length} member${members.length === 1 ? '' : 's'} added to project`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useChangeMemberRole(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, data }: { memberId: string; data: ChangeRolePayload }) =>
      api.changeMemberRole(projectId, memberId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['members', projectId] });
      toast.success('Role updated');
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useRemoveMember(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, name }: { memberId: string; name: string }) =>
      api.removeMember(projectId, memberId).then(() => name),
    onSuccess: (name) => {
      void queryClient.invalidateQueries({ queryKey: ['members', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
      void queryClient.invalidateQueries({ queryKey: ['bugs', projectId] });
      toast.success(`${name} removed from project`);
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });
}

export function useMemberActiveWork(projectId: string, memberId: string | null) {
  return useQuery({
    queryKey: ['member-active-work', projectId, memberId],
    queryFn: () => api.getMemberActiveWork(projectId, memberId!),
    enabled: !!memberId,
  });
}
