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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useSearchUsers, useAddMember } from '@/hooks/useMembers';
import type { ProjectRole, UserSearchResult } from '@/lib/types';

// FieldGroup + Field composition per shadcn skill rules
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

const ROLES: { value: ProjectRole; label: string }[] = [
  { value: 'PM', label: 'PM' },
  { value: 'BA', label: 'BA' },
  { value: 'QC', label: 'QC' },
  { value: 'DEVELOPER', label: 'Developer' },
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

interface AddMemberDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddMemberDialog({ projectId, open, onOpenChange }: AddMemberDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserSearchResult | null>(null);
  const [selectedRole, setSelectedRole] = useState<ProjectRole>('DEVELOPER');

  const { data: searchResults = [], isFetching } = useSearchUsers(projectId, searchQuery);
  const addMember = useAddMember(projectId);

  const handleAdd = () => {
    if (!selectedUser) return;
    addMember.mutate(
      { userId: selectedUser.id, role: selectedRole },
      {
        onSuccess: () => {
          handleClose();
        },
      },
    );
  };

  const handleClose = useCallback(() => {
    setSearchQuery('');
    setSelectedUser(null);
    setSelectedRole('DEVELOPER');
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
          <DialogTitle>Add Member</DialogTitle>
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
                {isFetching ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Searching...
                  </div>
                ) : searchQuery.length < 2 ? (
                  <div className="py-6 text-center text-sm text-muted-foreground">
                    Type at least 2 characters to search
                  </div>
                ) : (
                  <>
                    <CommandEmpty>No users found</CommandEmpty>
                    <CommandGroup>
                      {searchResults.map((user) => (
                        <CommandItem
                          key={user.id}
                          value={user.id}
                          onSelect={() => setSelectedUser(user)}
                          data-checked={selectedUser?.id === user.id}
                        >
                          <Avatar size="sm">
                            <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium">{user.name}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {user.email}
                            </p>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </>
                )}
              </CommandList>
            </Command>
            {selectedUser && (
              <p className="text-xs text-muted-foreground">
                Selected: <span className="font-medium text-foreground">{selectedUser.name}</span>
              </p>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="member-role">Role</FieldLabel>
            <Select
              value={selectedRole}
              onValueChange={(v) => setSelectedRole(v as ProjectRole)}
            >
              <SelectTrigger id="member-role" className="w-full">
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {ROLES.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>
        </FieldGroup>

        <DialogFooter className="mt-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={addMember.isPending}
          >
            Discard
          </Button>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={!selectedUser || addMember.isPending}
          >
            {addMember.isPending ? 'Adding...' : 'Add'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
