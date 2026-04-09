import { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { useSearchUsers, useAddMembers } from '@/hooks/useMembers';
import { useRoles } from '@/hooks/useRoles';
import type { CustomRole, UserSearchResult } from '@/lib/types';

function FieldGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-4">{children}</div>;
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-1.5">{children}</div>;
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="text-[13px] font-semibold leading-none">
      {children}
    </label>
  );
}


function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface QueueEntry {
  user: UserSearchResult;
  roleId: string;
  roleName: string;
}

interface AddMemberDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddMemberDialog({ projectId, open, onOpenChange }: AddMemberDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [queue, setQueue] = useState<QueueEntry[]>([]);

  const { data: searchResults = [], isFetching } = useSearchUsers(projectId, searchQuery);
  const addMembers = useAddMembers(projectId);
  const { data: roles = [] } = useRoles(projectId);

  // Set default role to the project's default role
  const defaultRole = roles.find((r) => r.isDefault) ?? roles[0];
  const effectiveRoleId = selectedRoleId || defaultRole?.id || '';

  // Exclude users already in queue from search results
  const queuedUserIds = new Set(queue.map((e) => e.user.id));
  const filteredResults = searchResults.filter((u) => !queuedUserIds.has(u.id));

  const handleAddToQueue = () => {
    if (!selectedUser || !effectiveRoleId) return;
    const role = roles.find((r) => r.id === effectiveRoleId);
    setQueue((prev) => [...prev, { user: selectedUser, roleId: effectiveRoleId, roleName: role?.name ?? 'Unknown' }]);
    setSearchQuery('');
    setSelectedUser(null);
    setSelectedRoleId('');
  };

  const handleRemoveFromQueue = (userId: string) => {
    setQueue((prev) => prev.filter((e) => e.user.id !== userId));
  };

  const handleSubmit = () => {
    if (queue.length === 0) return;
    addMembers.mutate(
      { members: queue.map((e) => ({ userId: e.user.id, roleId: e.roleId })) },
      { onSuccess: () => handleClose() },
    );
  };

  const handleClose = useCallback(() => {
    setSearchQuery('');
    setSelectedUser(null);
    setSelectedRoleId('');
    setQueue([]);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) handleClose();
    else onOpenChange(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[520px] max-w-full">
        <DialogHeader>
          <DialogTitle>Add Members</DialogTitle>
        </DialogHeader>

        <FieldGroup>
          <Field>
            <FieldLabel>Search users</FieldLabel>
            <Command className="rounded-lg border border-input">
              <CommandInput
                placeholder="Search by name or email..."
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                {searchQuery.length < 2 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Type at least 2 characters to search
                  </div>
                ) : isFetching ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Searching...
                  </div>
                ) : (
                  <>
                    <CommandEmpty>No users found</CommandEmpty>
                    <CommandGroup>
                      {filteredResults.map((user) => (
                        <CommandItem
                          key={user.id}
                          value={user.id}
                          onSelect={() => setSelectedUser(user)}
                          data-checked={selectedUser?.id === user.id}
                        >
                          <Avatar size="sm">
                            {user.imageUrl && <AvatarImage src={user.imageUrl} alt={user.name ?? user.username} />}
                            <AvatarFallback>{getInitials(user.name ?? user.username)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{user.name ?? user.username}</p>
                            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
          </Field>

          <div className="flex items-end gap-2">
            <div className="flex flex-1 flex-col gap-1.5">
              <FieldLabel htmlFor="member-role">Role</FieldLabel>
              <Select
                value={effectiveRoleId}
                onValueChange={(v) => setSelectedRoleId(v)}
              >
                <SelectTrigger id="member-role" className="w-full">
                  <SelectValue placeholder="Select role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={handleAddToQueue}
              disabled={!selectedUser}
              className="shrink-0"
            >
              Add to list
            </Button>
          </div>

          {queue.length > 0 && (
            <Field>
              <FieldLabel>Members to add ({queue.length})</FieldLabel>
              <div className="flex flex-col gap-2 rounded-lg border border-input p-2">
                {queue.map(({ user, roleName }) => (
                  <div
                    key={user.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5"
                  >
                    <Avatar size="sm">
                      {user.imageUrl && <AvatarImage src={user.imageUrl} alt={user.name ?? user.username} />}
                      <AvatarFallback>{getInitials(user.name ?? user.username)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{user.name ?? user.username}</p>
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {roleName}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => handleRemoveFromQueue(user.id)}
                      className="ml-1 shrink-0 text-muted-foreground hover:text-foreground"
                      aria-label={`Remove ${user.name ?? user.username} from list`}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </Field>
          )}
        </FieldGroup>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={addMembers.isPending}
          >
            Discard
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={queue.length === 0 || addMembers.isPending}
          >
            {addMembers.isPending
              ? 'Adding...'
              : queue.length === 0
                ? 'Add Members'
                : `Add ${queue.length} Member${queue.length === 1 ? '' : 's'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
