import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from 'cmdk';
import { api } from '@/lib/api';
import { useMembers } from '@/hooks/useMembers';

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

interface Props {
  projectId: string;
  canManage: boolean;
}

export function DefaultWatchersCard({ projectId, canManage }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const { data: defaults = [] } = useQuery({
    queryKey: ['default-watchers', projectId],
    queryFn: () => api.getDefaultWatchers(projectId),
    enabled: !!projectId,
  });
  const { data: members = [] } = useMembers(projectId);

  useEffect(() => {
    setSelectedIds(defaults.map((w) => w.userId));
  }, [defaults]);

  const save = useMutation({
    mutationFn: (userIds: string[]) => api.setDefaultWatchers(projectId, userIds),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['default-watchers', projectId] });
      toast.success('Default watchers saved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const selectedSet = new Set(selectedIds);
  const selectedMembers = members.filter((m) => selectedSet.has(m.userId));
  const availableMembers = members.filter((m) => !selectedSet.has(m.userId));
  const savedIds = new Set(defaults.map((w) => w.userId));
  const dirty =
    selectedIds.length !== savedIds.size || selectedIds.some((id) => !savedIds.has(id));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Eye className="size-5 text-muted-foreground" />
          <CardTitle>Default Watchers</CardTitle>
        </div>
        <CardDescription>
          These members are automatically added as watchers when a task is created.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {selectedMembers.map((m) => (
            <div key={m.userId} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs group max-w-full min-w-0">
              <Avatar className="size-4 shrink-0">
                {m.user.imageUrl && <AvatarImage src={m.user.imageUrl} />}
                <AvatarFallback className="text-[8px]">
                  {getInitials(m.user.name ?? m.user.username)}
                </AvatarFallback>
              </Avatar>
              <span className="truncate">{m.user.name ?? m.user.username}</span>
              {canManage && (
                <button
                  onClick={() => setSelectedIds((ids) => ids.filter((id) => id !== m.userId))}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <X className="size-3" />
                </button>
              )}
            </div>
          ))}
          {canManage && (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="size-6 rounded-full">
                  <Plus className="size-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-3 rounded-xl border bg-popover shadow-2xl">
                <Command className="w-full">
                  <div className="flex items-center h-9 px-2 rounded-md border bg-background focus-within:ring-2 focus-within:ring-primary">
                    <CommandInput
                      placeholder="Search members..."
                      className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  <div className="h-px bg-border my-2" />
                  <CommandList className="max-h-64 overflow-y-auto">
                    <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                      No members found
                    </CommandEmpty>
                    <CommandGroup heading="Members" className="px-1 py-1 text-[11px] font-medium text-muted-foreground">
                      {availableMembers.map((m) => (
                        <CommandItem
                          key={m.userId}
                          onSelect={() => {
                            setSelectedIds((ids) => [...ids, m.userId]);
                            setOpen(false);
                          }}
                          className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer hover:bg-accent hover:text-accent-foreground data-[selected=true]:bg-accent transition-all duration-150"
                        >
                          <Avatar className="size-7 shrink-0">
                            {m.user.imageUrl && <AvatarImage src={m.user.imageUrl} />}
                            <AvatarFallback className="text-[10px]">
                              {getInitials(m.user.name ?? m.user.username)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-medium truncate">{m.user.name ?? m.user.username}</span>
                            <span className="text-xs text-muted-foreground truncate">@{m.user.username}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          )}
        </div>
        {selectedMembers.length === 0 && (
          <p className="text-sm text-muted-foreground">No default watchers configured.</p>
        )}
        {canManage && (
          <div className="flex justify-end">
            <Button
              size="sm"
              disabled={!dirty || save.isPending}
              onClick={() => save.mutate(selectedIds)}
            >
              Save
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
