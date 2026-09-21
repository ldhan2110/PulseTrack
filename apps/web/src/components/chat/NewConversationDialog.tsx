import { useMemo, useRef, useState } from 'react';
import { Hash, Plus, Search, SearchX } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuth } from '@/auth/useAuth';
import { useUiStore } from '@/store/uiStore';
import {
  useConversations,
  useSearchChatTargets,
  useCreateConversation,
} from '@/hooks/useChat';
import { initials, peerOf } from './chatUtils';

export function NewConversationDialog() {
  const { user } = useAuth();
  const myId = user?.id ?? '';
  const open = useUiStore((s) => s.chatOverlayOpen);
  const setOpen = useUiStore((s) => s.setChatOverlayOpen);
  const setActive = useUiStore((s) => s.setActiveConversationId);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: people } = useSearchChatTargets(query);
  const { data: conversations } = useConversations();
  const create = useCreateConversation();

  const q = query.trim().toLowerCase();
  const showingRecent = q.length === 0;
  const channels = (conversations ?? []).filter(
    (c) => c.type === 'CHANNEL' && (c.name ?? '').toLowerCase().includes(q),
  );

  // Idle state: recent DM peers, most-recent first, deduped.
  const recentPeers = useMemo(() => {
    const seen = new Set<string>();
    const out: { id: string; name: string | null; username: string; imageUrl: string | null }[] = [];
    for (const c of conversations ?? []) {
      if (c.type !== 'DM') continue;
      const peer = peerOf(c, myId);
      if (!peer || seen.has(peer.id)) continue;
      seen.add(peer.id);
      out.push(peer);
    }
    return out;
  }, [conversations, myId]);

  const peopleResults = showingRecent ? recentPeers : (people ?? []);

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

  function openChannel(id: string) {
    setActive(id);
    close();
  }

  function createChannel() {
    if (!query.trim()) return;
    create.mutate(
      { type: 'CHANNEL', name: query.trim(), memberIds: [] },
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
    setQuery('');
  }

  const noMatch =
    q.length > 0 && peopleResults.length === 0 && channels.length === 0;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
        </DialogHeader>

        <div className="flex min-h-[200px] flex-col gap-3 px-4 pb-4">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people & channels"
            className="pl-8"
          />
        </div>

        <Tabs defaultValue="all" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="all" className="flex-1">All</TabsTrigger>
            <TabsTrigger value="people" className="flex-1">People</TabsTrigger>
            <TabsTrigger value="channels" className="flex-1">Channels</TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <PeopleList
              people={peopleResults}
              onMessage={startDm}
              label={showingRecent ? 'Recent' : undefined}
              showingRecent={showingRecent}
              onCreateChannel={() => inputRef.current?.focus()}
            />
            <ChannelList channels={channels} onOpen={openChannel} />
          </TabsContent>
          <TabsContent value="people">
            <PeopleList
              people={peopleResults}
              onMessage={startDm}
              label={showingRecent ? 'Recent' : undefined}
              showingRecent={showingRecent}
              onCreateChannel={() => inputRef.current?.focus()}
            />
          </TabsContent>
          <TabsContent value="channels">
            <ChannelList
              channels={channels}
              onOpen={openChannel}
              showEmpty
              query={query.trim()}
              onCreateChannel={() =>
                query.trim() ? createChannel() : inputRef.current?.focus()
              }
            />
          </TabsContent>
        </Tabs>

        {noMatch && (
          <div className="flex flex-col items-center gap-1 px-4 py-8 text-center">
            <SearchX className="size-8 text-muted-foreground/50" />
            <p className="text-sm font-medium">
              No one called “{query.trim()}”
            </p>
            <p className="text-xs text-muted-foreground">
              Check the spelling, or spin up a channel with that name below.
            </p>
          </div>
        )}

        {query.trim() && (
          <Button variant="outline" className="mt-1 justify-start gap-2" onClick={createChannel}>
            <Plus className="size-4" /> Create channel “{query.trim()}”
          </Button>
        )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PeopleList({
  people,
  onMessage,
  label,
  showingRecent,
  onCreateChannel,
}: {
  people: { id: string; name: string | null; username: string; imageUrl: string | null }[];
  onMessage: (id: string) => void;
  label?: string;
  showingRecent?: boolean;
  onCreateChannel?: () => void;
}) {
  // Empty recent list: guide the user instead of showing a blank panel.
  if (people.length === 0) {
    if (!showingRecent) return null;
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <Search className="size-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">No recent chats yet</p>
        <p className="text-xs text-muted-foreground">
          Search a teammate’s name above, or start a channel.
        </p>
        {onCreateChannel && (
          <Button variant="outline" size="sm" className="mt-1 gap-1.5" onClick={onCreateChannel}>
            <Plus className="size-4" /> Create a channel
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="max-h-96 space-y-1 overflow-y-auto py-1">
      {label && (
        <p className="px-2 pb-0.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
      )}
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

function ChannelList({
  channels,
  onOpen,
  showEmpty,
  query,
  onCreateChannel,
}: {
  channels: { id: string; name: string | null }[];
  onOpen: (id: string) => void;
  showEmpty?: boolean;
  query?: string;
  onCreateChannel?: () => void;
}) {
  if (channels.length === 0) {
    if (!showEmpty) return null;
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
        <Hash className="size-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">
          {query ? `No channels match “${query}”` : 'No channels yet'}
        </p>
        <p className="text-xs text-muted-foreground">
          {query ? 'Create it below, or check the spelling.' : 'Start one to group a conversation by topic.'}
        </p>
        {onCreateChannel && (
          <Button variant="outline" size="sm" className="mt-1 gap-1.5" onClick={onCreateChannel}>
            <Plus className="size-4" /> {query ? `Create “${query}”` : 'Create a channel'}
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="max-h-96 space-y-1 overflow-y-auto py-1">
      {channels.map((c) => (
        <button
          key={c.id}
          type="button"
          onClick={() => onOpen(c.id)}
          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
        >
          <Hash className="size-4 text-muted-foreground" />
          <span className="flex-1 truncate text-sm">{c.name ?? 'channel'}</span>
        </button>
      ))}
    </div>
  );
}
