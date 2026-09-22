import { useMemo, useRef, useState } from 'react';
import { Hash, Loader2, MessageSquare, Plus, Search, SearchX, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useAuth } from '@/auth/useAuth';
import { useUiStore } from '@/store/uiStore';
import {
  useSearchChatTargets,
  useCreateConversation,
} from '@/hooks/useChat';
import { initials } from './chatUtils';

type ChatTarget = {
  id: string;
  name: string | null;
  username: string;
  imageUrl: string | null;
};

export function NewConversationDialog() {
  const { user } = useAuth();
  const myId = user?.id ?? '';
  const open = useUiStore((s) => s.chatOverlayOpen);
  const setOpen = useUiStore((s) => s.setChatOverlayOpen);
  const setActive = useUiStore((s) => s.setActiveConversationId);

  const [mode, setMode] = useState<'dm' | 'channel'>('dm');
  // DM search
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  // Channel form
  const [channelName, setChannelName] = useState('');
  const [memberQuery, setMemberQuery] = useState('');
  const [members, setMembers] = useState<ChatTarget[]>([]);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const { data: people } = useSearchChatTargets(query);
  const { data: memberResults } = useSearchChatTargets(memberQuery);
  const create = useCreateConversation();

  const peopleResults = (people ?? []) as ChatTarget[];
  const noMatch = query.trim().length > 0 && peopleResults.length === 0;

  const memberSuggestions = useMemo(() => {
    const chosen = new Set([myId, ...members.map((m) => m.id)]);
    return ((memberResults ?? []) as ChatTarget[]).filter((r) => !chosen.has(r.id));
  }, [memberResults, members, myId]);

  const nameBlank = channelName.trim().length === 0;
  const nameError = submitAttempted && nameBlank;

  function startDm(userId: string) {
    create.mutate(
      { type: 'DM', memberIds: [userId] },
      {
        onSuccess: (conv) => {
          setActive(conv.id);
          close();
        },
      },
    );
  }

  function toggleMember(t: ChatTarget) {
    setMembers((cur) =>
      cur.some((m) => m.id === t.id) ? cur.filter((m) => m.id !== t.id) : [...cur, t],
    );
    setMemberQuery('');
  }

  function createChannel() {
    setSubmitAttempted(true);
    if (nameBlank) return;
    create.mutate(
      { type: 'CHANNEL', name: channelName.trim(), memberIds: members.map((m) => m.id) },
      {
        onSuccess: (conv) => {
          setActive(conv.id);
          close();
        },
      },
    );
  }

  function close() {
    setOpen(false);
    setMode('dm');
    setQuery('');
    setChannelName('');
    setMemberQuery('');
    setMembers([]);
    setSubmitAttempted(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-[240px] flex-col gap-3 px-4 pb-4">
          {/* DM | Channel segmented toggle */}
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            <Button
              type="button"
              variant={mode === 'dm' ? 'default' : 'ghost'}
              size="sm"
              className="gap-1.5"
              onClick={() => setMode('dm')}
            >
              <MessageSquare className="size-4" /> Direct message
            </Button>
            <Button
              type="button"
              variant={mode === 'channel' ? 'default' : 'ghost'}
              size="sm"
              className="gap-1.5"
              onClick={() => setMode('channel')}
            >
              <Hash className="size-4" /> Channel
            </Button>
          </div>

          {mode === 'dm' ? (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                <Input
                  ref={inputRef}
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search people"
                  className="pl-8"
                />
              </div>
              {noMatch ? (
                <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
                  <SearchX className="size-8 text-muted-foreground/50" />
                  <p className="text-sm font-medium">No one called “{query.trim()}”</p>
                  <p className="text-xs text-muted-foreground">
                    Check the spelling, or switch to Channel to create one.
                  </p>
                </div>
              ) : (
                <PeopleList people={peopleResults} onMessage={startDm} />
              )}
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Channel name
                </label>
                <div className="relative">
                  <Hash className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    autoFocus
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    placeholder="eng-team"
                    aria-invalid={nameError}
                    className={cn('pl-8', nameError && 'border-destructive ring-destructive/20')}
                  />
                </div>
                {nameError && (
                  <p className="mt-1 text-xs text-destructive">Give the channel a name.</p>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  Add members <span className="font-normal">(optional)</span>
                </label>
                {members.length > 0 && (
                  <div className="mb-1.5 flex flex-wrap gap-1.5">
                    {members.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1 rounded-full bg-secondary py-0.5 pl-1 pr-2 text-xs text-secondary-foreground"
                      >
                        <Avatar className="size-4">
                          {m.imageUrl && <AvatarImage src={m.imageUrl} />}
                          <AvatarFallback className="text-[8px]">{initials(m)}</AvatarFallback>
                        </Avatar>
                        {m.name ?? m.username}
                        <button
                          type="button"
                          onClick={() => toggleMember(m)}
                          className="text-muted-foreground hover:text-foreground"
                          aria-label={`Remove ${m.name ?? m.username}`}
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
                  <Input
                    value={memberQuery}
                    onChange={(e) => setMemberQuery(e.target.value)}
                    placeholder="Search teammates"
                    className="pl-8"
                  />
                </div>
                {memberQuery.trim() && (
                  <div className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-md border p-1">
                    {memberSuggestions.length === 0 ? (
                      <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                        No teammates match “{memberQuery.trim()}”
                      </p>
                    ) : (
                      memberSuggestions.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleMember(p)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                        >
                          <Avatar className="size-6">
                            {p.imageUrl && <AvatarImage src={p.imageUrl} />}
                            <AvatarFallback className="text-[10px]">{initials(p)}</AvatarFallback>
                          </Avatar>
                          <span className="flex-1 truncate text-sm">{p.name ?? p.username}</span>
                          <Plus className="size-4 text-muted-foreground" />
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="mt-1 flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={close} disabled={create.isPending}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={createChannel}
                  disabled={nameBlank || create.isPending}
                >
                  {create.isPending && <Loader2 className="size-4 animate-spin" />}
                  {create.isPending ? 'Creating…' : 'Create'}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PeopleList({
  people,
  onMessage,
}: {
  people: ChatTarget[];
  onMessage: (id: string) => void;
}) {
  if (people.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <Search className="size-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">Search a teammate</p>
        <p className="text-xs text-muted-foreground">
          Type a name above to start a direct message.
        </p>
      </div>
    );
  }
  return (
    <div className="max-h-96 space-y-1 overflow-y-auto py-1">
      {people.map((p) => (
        <button
          key={p.id}
          type="button"
          onClick={() => onMessage(p.id)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
        >
          <Avatar className="size-6">
            {p.imageUrl && <AvatarImage src={p.imageUrl} />}
            <AvatarFallback className="text-[10px]">{initials(p)}</AvatarFallback>
          </Avatar>
          <span className="flex-1 truncate text-sm">{p.name ?? p.username}</span>
        </button>
      ))}
    </div>
  );
}
