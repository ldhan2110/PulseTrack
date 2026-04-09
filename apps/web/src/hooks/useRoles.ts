import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../lib/api';
import type { RolePermissions } from '../lib/permissions';

export function useRoles(projectId: string) {
  return useQuery({
    queryKey: ['roles', projectId],
    queryFn: () => api.getRoles(projectId),
    enabled: !!projectId,
  });
}

export function useCreateRole(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; permissions: RolePermissions }) =>
      api.createRole(projectId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['roles', projectId] });
      toast.success('Role created');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateRole(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, data }: { roleId: string; data: Partial<{ name: string; permissions: RolePermissions; isDefault: boolean }> }) =>
      api.updateRole(projectId, roleId, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['roles', projectId] });
      void qc.invalidateQueries({ queryKey: ['members', projectId] });
      toast.success('Role updated');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteRole(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => api.deleteRole(projectId, roleId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['roles', projectId] });
      void qc.invalidateQueries({ queryKey: ['members', projectId] });
      toast.success('Role deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
