import { useState } from 'react';
import { Eye, EyeOff, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from 'cmdk';
import { useWatchers, useAddWatchers, useRemoveWatcher } from '@/hooks/useWatchers';
import { useMembers } from '@/hooks/useMembers';
import type { EntityType } from '@/lib/types';

function getInitials(name: string): string {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

interface WatcherSelectProps {
  projectId: string;
  entityType: EntityType;
  entityId: string;
  currentUserId: string;
}

export function WatcherSelect({ projectId, entityType, entityId, currentUserId }: WatcherSelectProps) {
  const [open, setOpen] = useState(false);
  const { data: watchers = [] } = useWatchers(projectId, entityType, entityId);
  const { data: members = [] } = useMembers(projectId);
  const addWatchers = useAddWatchers(projectId, entityType, entityId);
  const removeWatcher = useRemoveWatcher(projectId, entityType, entityId);

  const watcherUserIds = new Set(watchers.map((w) => w.userId));
  const isWatching = watcherUserIds.has(currentUserId);
  const nonWatcherMembers = members.filter((m) => !watcherUserIds.has(m.userId));

  const handleToggleSelf = () => {
    if (isWatching) {
      removeWatcher.mutate(currentUserId);
    } else {
      addWatchers.mutate([currentUserId]);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-semibold text-muted-foreground">Watchers</span>
        <Button variant="ghost" size="sm" className="h-6 px-2 text-xs gap-1" onClick={handleToggleSelf}>
          {isWatching ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
          {isWatching ? 'Unwatch' : 'Watch'}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {watchers.map((w) => (
          <div key={w.id} className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs group max-w-full min-w-0">
            <Avatar className="size-4 shrink-0">
              {w.user.imageUrl && <AvatarImage src={w.user.imageUrl} />}
              <AvatarFallback className="text-[8px]">
                {getInitials(w.user.name ?? w.user.username)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate">{w.user.name ?? w.user.username}</span>
            <button onClick={() => removeWatcher.mutate(w.userId)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <X className="size-3" />
            </button>
          </div>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="size-6 rounded-full">
              <Plus className="size-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-72 p-3 rounded-xl border bg-popover shadow-2xl"
          >
            <Command className="w-full">
              
              {/* 🔍 Search */}
              <div className="flex items-center h-9 px-2 rounded-md border bg-background focus-within:ring-2 focus-within:ring-primary">
                <CommandInput
                  placeholder="Search members..."
                  className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                />
              </div>

              {/* Divider */}
              <div className="h-px bg-border my-2" />

              {/* List */}
              <CommandList className="max-h-64 overflow-y-auto">
                <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                  No members found
                </CommandEmpty>

                <CommandGroup
                  heading="Members"
                  className="px-1 py-1 text-[11px] font-medium text-muted-foreground"
                >
                  {nonWatcherMembers.map((m) => (
                    <CommandItem
                      key={m.userId}
                      onSelect={() => {
                        addWatchers.mutate([m.userId]);
                        setOpen(false);
                      }}
                      className="
                        flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer
                        hover:bg-accent hover:text-accent-foreground
                        data-[selected=true]:bg-accent
                        transition-all duration-150
                      "
                    >
                      <Avatar className="size-7 shrink-0">
                        {m.user.imageUrl && (
                          <AvatarImage src={m.user.imageUrl} />
                        )}
                        <AvatarFallback className="text-[10px]">
                          {getInitials(m.user.name ?? m.user.username)}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-medium truncate">
                          {m.user.name ?? m.user.username}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          @{m.user.username}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
