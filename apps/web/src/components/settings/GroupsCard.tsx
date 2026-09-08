import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, X, Trash2, MoreHorizontal, Users, Pencil, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from 'cmdk';
import { api } from '@/lib/api';
import { useMembers } from '@/hooks/useMembers';
import type { Group } from '@/lib/types';

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

interface Props {
  projectId: string;
  canManage: boolean;
}

export function GroupsCard({ projectId, canManage }: Props) {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  const { data: groups = [] } = useQuery({
    queryKey: ['groups', projectId],
    queryFn: () => api.getGroups(projectId),
    enabled: !!projectId,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['groups', projectId] });

  const create = useMutation({
    mutationFn: (name: string) => api.createGroup(projectId, { name }),
    onSuccess: () => {
      void invalidate();
      setNewName('');
      toast.success('Group created');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (groupId: string) => api.deleteGroup(projectId, groupId),
    onSuccess: () => {
      void invalidate();
      setOpenGroupId(null);
      toast.success('Group deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const setMembers = useMutation({
    mutationFn: ({ groupId, memberIds }: { groupId: string; memberIds: string[] }) =>
      api.setGroupMembers(projectId, groupId, memberIds),
    onSuccess: () => void invalidate(),
    onError: (err: Error) => toast.error(err.message),
  });

  const rename = useMutation({
    mutationFn: ({ groupId, name }: { groupId: string; name: string }) =>
      api.updateGroup(projectId, groupId, { name }),
    onSuccess: () => void invalidate(),
    onError: (err: Error) => toast.error(err.message),
  });

  const openGroup = groups.find((g) => g.id === openGroupId) ?? null;

  return (
    <>
      {canManage && (
        <form
          className="mb-4 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newName.trim();
            if (name) create.mutate(name);
          }}
        >
          <Input
            placeholder="New group name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" disabled={!newName.trim() || create.isPending}>
            <Plus data-icon="inline-start" /> Add Group
          </Button>
        </form>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No groups yet.</p>
      ) : (
        <Table containerClassName="max-h-[calc(100vh-260px)]">
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Members</TableHead>
              {canManage && <TableHead className="w-16"></TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => (
              <TableRow
                key={group.id}
                className="cursor-pointer"
                onClick={() => setOpenGroupId(group.id)}
              >
                <TableCell>
                  <span className="text-sm font-medium">{group.name}</span>
                </TableCell>
                <TableCell>
                  {group.members.length === 0 ? (
                    <span className="text-sm text-muted-foreground">No members</span>
                  ) : (
                    <div className="flex -space-x-2">
                      {group.members.slice(0, 5).map((m) => (
                        <Avatar key={m.id} size="sm" className="ring-2 ring-background">
                          {m.user.imageUrl && <AvatarImage src={m.user.imageUrl} alt={m.user.name ?? m.user.username} />}
                          <AvatarFallback>{getInitials(m.user.name ?? m.user.username)}</AvatarFallback>
                        </Avatar>
                      ))}
                      {group.members.length > 5 && (
                        <div className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium ring-2 ring-background">
                          +{group.members.length - 5}
                        </div>
                      )}
                    </div>
                  )}
                </TableCell>
                {canManage && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm">
                          <MoreHorizontal />
                          <span className="sr-only">Group actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-44">
                        <DropdownMenuItem
                          className="whitespace-nowrap"
                          onSelect={() => setOpenGroupId(group.id)}
                        >
                          <Settings2 /> Manage members
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() => remove.mutate(group.id)}
                        >
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <GroupMembersDialog
        group={openGroup}
        projectId={projectId}
        canManage={canManage}
        onOpenChange={(open) => !open && setOpenGroupId(null)}
        onSetMembers={(memberIds) =>
          openGroup && setMembers.mutate({ groupId: openGroup.id, memberIds })
        }
        onRename={(name) => openGroup && rename.mutate({ groupId: openGroup.id, name })}
        onDelete={() => openGroup && remove.mutate(openGroup.id)}
      />
    </>
  );
}

function GroupMembersDialog({
  group,
  projectId,
  canManage,
  onOpenChange,
  onSetMembers,
  onRename,
  onDelete,
}: {
  group: Group | null;
  projectId: string;
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  onSetMembers: (memberIds: string[]) => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const { data: members = [] } = useMembers(projectId);

  if (!group) return null;

  const currentIds = group.members.map((m) => m.id);
  const currentSet = new Set(currentIds);
  const availableMembers = members.filter((m) => !currentSet.has(m.id));

  const commitRename = () => {
    const name = draftName.trim();
    setEditing(false);
    if (name && name !== group.name) onRename(name);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0">
        <DialogHeader className="border-b px-5 py-4">
          <div className="flex items-center gap-3 pr-6">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              {editing ? (
                <Input
                  autoFocus
                  className="h-7 max-w-64"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                />
              ) : (
                <DialogTitle
                  className={
                    canManage
                      ? 'inline-flex items-center gap-1.5 cursor-pointer hover:text-primary'
                      : undefined
                  }
                  onClick={() => {
                    if (!canManage) return;
                    setDraftName(group.name);
                    setEditing(true);
                  }}
                >
                  {group.name}
                  {canManage && <Pencil className="size-3 text-muted-foreground" />}
                </DialogTitle>
              )}
              <DialogDescription className="mt-0.5">
                {group.members.length} member{group.members.length !== 1 ? 's' : ''}
              </DialogDescription>
            </div>
            {canManage && (
              <Button
                variant="ghost"
                size="icon-sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </DialogHeader>

        <DialogBody className="space-y-3 px-5 py-4">
          {canManage && (
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-full justify-start border-dashed text-muted-foreground">
                  <Plus className="size-4" /> Add members
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-2 rounded-xl border bg-popover shadow-2xl">
                <Command className="w-full">
                  <div className="flex items-center h-9 px-2 rounded-md border bg-background focus-within:ring-2 focus-within:ring-primary">
                    <CommandInput
                      placeholder="Search members..."
                      className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <CommandList className="mt-2 max-h-64 overflow-y-auto">
                    <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                      Everyone's already in this group
                    </CommandEmpty>
                    <CommandGroup>
                      {availableMembers.map((m) => (
                        <CommandItem
                          key={m.id}
                          onSelect={() => onSetMembers([...currentIds, m.id])}
                          className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent transition-all duration-150"
                        >
                          <Avatar size="sm" className="shrink-0">
                            {m.user.imageUrl && <AvatarImage src={m.user.imageUrl} />}
                            <AvatarFallback className="text-[10px]">
                              {getInitials(m.user.name ?? m.user.username)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium truncate">{m.user.name ?? m.user.username}</span>
                            <span className="text-xs text-muted-foreground truncate">{m.user.email}</span>
                          </div>
                          <Plus className="ml-auto size-4 text-muted-foreground" />
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}

          {group.members.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <div className="flex size-11 items-center justify-center rounded-full bg-muted">
                <Users className="size-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No members in this group yet.</p>
            </div>
          ) : (
            <div className="max-h-80 space-y-1 overflow-y-auto">
              {group.members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-lg px-2 py-2 group hover:bg-muted/50 transition-colors"
                >
                  <Avatar size="sm" className="shrink-0">
                    {m.user.imageUrl && <AvatarImage src={m.user.imageUrl} />}
                    <AvatarFallback className="text-[10px]">
                      {getInitials(m.user.name ?? m.user.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-sm font-medium truncate">{m.user.name ?? m.user.username}</span>
                    <span className="text-xs text-muted-foreground truncate">{m.user.email}</span>
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={() => onSetMembers(currentIds.filter((id) => id !== m.id))}
                    >
                      <X className="size-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
