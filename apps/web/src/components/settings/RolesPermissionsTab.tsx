import { useState } from 'react';
import { useRoles, useCreateRole, useUpdateRole, useDeleteRole } from '@/hooks/useRoles';
import { PERMISSION_AREAS, PERMISSION_ACTIONS, type RolePermissions } from '@/lib/permissions';
import type { CustomRole } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  projectId: string;
}

export function RolesPermissionsTab({ projectId }: Props) {
  const { data: roles = [] } = useRoles(projectId);
  const createRole = useCreateRole(projectId);
  const updateRole = useUpdateRole(projectId);
  const deleteRole = useDeleteRole(projectId);

  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [editPermissions, setEditPermissions] = useState<RolePermissions | null>(null);
  const [editName, setEditName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newRoleName, setNewRoleName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CustomRole | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);
  const defaultRole = roles.find((r) => r.isDefault);

  function selectRole(role: CustomRole) {
    setSelectedRoleId(role.id);
    setEditPermissions(role.permissions as RolePermissions);
    setEditName(role.name);
    setIsDirty(false);
  }

  function togglePermission(area: string, action: string) {
    if (!editPermissions || selectedRole?.isSystem) return;
    setEditPermissions((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        [area]: { ...prev[area], [action]: !prev[area]?.[action as keyof typeof prev[typeof area]] },
      };
    });
    setIsDirty(true);
  }

  function handleSave() {
    if (!selectedRoleId || !editPermissions) return;
    updateRole.mutate({
      roleId: selectedRoleId,
      data: { name: editName, permissions: editPermissions },
    });
    setIsDirty(false);
  }

  function handleCreate() {
    if (!newRoleName.trim()) return;
    const emptyPermissions: Record<string, Record<string, boolean>> = {};
    for (const area of PERMISSION_AREAS) {
      emptyPermissions[area.key] = { view: false, create: false, update: false, delete: false };
    }
    createRole.mutate(
      { name: newRoleName.trim(), permissions: emptyPermissions as unknown as RolePermissions },
      {
        onSuccess: (role) => {
          setIsCreating(false);
          setNewRoleName('');
          selectRole(role);
        },
      },
    );
  }

  function handleDelete() {
    if (!deleteTarget) return;
    deleteRole.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        if (selectedRoleId === deleteTarget.id) {
          setSelectedRoleId(null);
          setEditPermissions(null);
        }
      },
    });
  }

  return (
    <div className="flex gap-0 min-h-[500px] border rounded-lg">
      {/* Left: Role list */}
      <div className="w-56 border-r p-4 flex-shrink-0">
        <div className="flex justify-between items-center mb-4">
          <span className="font-semibold text-sm">Roles</span>
          <Button size="sm" variant="outline" onClick={() => setIsCreating(true)}>
            + New Role
          </Button>
        </div>

        {isCreating && (
          <div className="mb-2 flex gap-1">
            <Input
              value={newRoleName}
              onChange={(e) => setNewRoleName(e.target.value)}
              placeholder="Role name"
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              autoFocus
            />
            <Button size="sm" onClick={handleCreate}>Add</Button>
            <Button size="sm" variant="ghost" onClick={() => { setIsCreating(false); setNewRoleName(''); }}>
              Cancel
            </Button>
          </div>
        )}

        <div className="space-y-2">
          {roles.map((role) => (
            <div
              key={role.id}
              className={`p-2.5 rounded-md border cursor-pointer transition-colors ${
                selectedRoleId === role.id
                  ? 'bg-primary/10 border-primary/30'
                  : 'bg-muted/30 border-border hover:bg-muted/50'
              }`}
              onClick={() => selectRole(role)}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{role.name}</span>
                {role.isSystem && <Badge variant="secondary" className="text-[10px] px-1.5">SYSTEM</Badge>}
                {role.isDefault && <Badge className="text-[10px] px-1.5 bg-green-500/20 text-green-500 border-green-500/30">DEFAULT</Badge>}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {role._count?.members ?? 0} member{(role._count?.members ?? 0) !== 1 ? 's' : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Permission grid */}
      <div className="flex-1 p-4 overflow-x-auto">
        {selectedRole ? (
          <>
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-3">
                {selectedRole.isSystem ? (
                  <span className="font-semibold text-lg">{selectedRole.name}</span>
                ) : (
                  <Input
                    value={editName}
                    onChange={(e) => { setEditName(e.target.value); setIsDirty(true); }}
                    className="font-semibold text-lg h-8 w-48"
                  />
                )}
                <span className="text-xs text-muted-foreground">
                  {selectedRole._count?.members ?? 0} members
                </span>
              </div>
              <div className="flex gap-2">
                {!selectedRole.isSystem && !selectedRole.isDefault && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateRole.mutate({ roleId: selectedRole.id, data: { isDefault: true } })}
                  >
                    Set as Default
                  </Button>
                )}
                {!selectedRole.isSystem && !selectedRole.isDefault && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setDeleteTarget(selectedRole)}
                  >
                    Delete Role
                  </Button>
                )}
              </div>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 w-40 font-semibold">Area</th>
                  {PERMISSION_ACTIONS.map((action) => (
                    <th key={action} className="text-center p-2 font-medium capitalize w-20">
                      {action}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_AREAS.map((area) => (
                  <tr key={area.key} className="border-b border-border/50">
                    <td className="p-2 font-medium">{area.label}</td>
                    {PERMISSION_ACTIONS.map((action) => {
                      const checked = editPermissions?.[area.key]?.[action] ?? false;
                      const disabled = selectedRole.isSystem;
                      return (
                        <td key={action} className="text-center p-2">
                          <Checkbox
                            checked={checked}
                            disabled={disabled}
                            onCheckedChange={() => togglePermission(area.key, action)}
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>

            {!selectedRole.isSystem && isDirty && (
              <div className="flex justify-end gap-2 mt-4">
                <Button variant="outline" onClick={() => selectRole(selectedRole)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={updateRole.isPending}>
                  Save Changes
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Select a role to edit permissions
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete role &ldquo;{deleteTarget?.name}&rdquo;?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?._count?.members
                ? `${deleteTarget._count.members} member(s) will be moved to "${defaultRole?.name ?? 'default role'}".`
                : 'No members are assigned to this role.'}
              {' '}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
