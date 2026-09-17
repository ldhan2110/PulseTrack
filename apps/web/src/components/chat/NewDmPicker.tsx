import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import type { Member } from '@/lib/types';

interface NewDmPickerProps {
  members: Member[];
  currentUserId: string;
  onPick: (userId: string) => void;
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function NewDmPicker({ members, currentUserId, onPick }: NewDmPickerProps) {
  const [query, setQuery] = useState('');
  const candidates = members
    .filter((m) => m.userId !== currentUserId)
    .filter((m) => {
      const name = m.user.name ?? m.user.username ?? '';
      return name.toLowerCase().includes(query.toLowerCase());
    });

  return (
    <div className="flex flex-1 flex-col">
      <div className="p-3">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search members…"
          autoFocus
        />
      </div>
      <div className="flex flex-col gap-0.5 overflow-y-auto px-2 pb-2">
        {candidates.length === 0 && (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">No members found</p>
        )}
        {candidates.map((m) => {
          const name = m.user.name ?? m.user.username ?? 'Unknown';
          return (
            <button
              key={m.userId}
              type="button"
              onClick={() => onPick(m.userId)}
              className="flex items-center gap-2.5 rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-secondary"
            >
              <Avatar className="size-7">
                <AvatarFallback className="text-[11px]">{initials(name)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{name}</span>
              <span className="ml-auto text-xs text-muted-foreground">
                {m.customRole?.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
