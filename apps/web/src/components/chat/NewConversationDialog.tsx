import { useState } from 'react';
import { Hash, Plus, Search } from 'lucide-react';
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
import { useUiStore } from '@/store/uiStore';
import {
  useConversations,
  useSearchChatTargets,
  useCreateConversation,
} from '@/hooks/useChat';
import { initials } from './chatUtils';

export function NewConversationDialog() {
  const open = useUiStore((s) => s.chatOverlayOpen);
  const setOpen = useUiStore((s) => s.setChatOverlayOpen);
  const setActive = useUiStore((s) => s.setActiveConversationId);
  const projectId = useUiStore((s) => s.activeProjectId);
  const [query, setQuery] = useState('');

  const { data: people } = useSearchChatTargets(projectId, query);
  const { data: conversations } = useConversations();
  const create = useCreateConversation();

  const q = query.trim().toLowerCase();
  const channels = (conversations ?? []).filter(
    (c) => c.type === 'CHANNEL' && (c.name ?? '').toLowerCase().includes(q),
  );
  const peopleResults = people ?? [];

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
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
            <PeopleList people={peopleResults} onMessage={startDm} projectId={projectId} />
            <ChannelList channels={channels} onOpen={openChannel} />
          </TabsContent>
          <TabsContent value="people">
            <PeopleList people={peopleResults} onMessage={startDm} projectId={projectId} />
          </TabsContent>
          <TabsContent value="channels">
            <ChannelList channels={channels} onOpen={openChannel} />
          </TabsContent>
        </Tabs>

        {noMatch && (
          <p className="px-1 text-sm text-muted-foreground">No people or channels match “{query}”.</p>
        )}

        {query.trim() && (
          <Button variant="outline" className="mt-1 justify-start gap-2" onClick={createChannel}>
            <Plus className="size-4" /> Create channel “{query.trim()}”
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PeopleList({
  people,
  onMessage,
  projectId,
}: {
  people: { id: string; name: string | null; username: string; imageUrl: string | null }[];
  onMessage: (id: string) => void;
  projectId: string | null;
}) {
  if (!projectId) {
    return (
      <p className="px-1 py-2 text-xs text-muted-foreground">
        Open a project to search people.
      </p>
    );
  }
  return (
    <div className="max-h-56 space-y-1 overflow-y-auto py-1">
      {people.map((p) => (
        <div key={p.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
          <Avatar className="size-6">
            {p.imageUrl && <AvatarImage src={p.imageUrl} />}
            <AvatarFallback className="text-[10px]">{initials(p)}</AvatarFallback>
          </Avatar>
          <span className="flex-1 truncate text-sm">{p.name ?? p.username}</span>
          <Button size="sm" variant="secondary" className="h-7" onClick={() => onMessage(p.id)}>
            Message
          </Button>
        </div>
      ))}
    </div>
  );
}

function ChannelList({
  channels,
  onOpen,
}: {
  channels: { id: string; name: string | null }[];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="max-h-56 space-y-1 overflow-y-auto py-1">
      {channels.map((c) => (
        <div key={c.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent">
          <Hash className="size-4 text-muted-foreground" />
          <span className="flex-1 truncate text-sm">{c.name ?? 'channel'}</span>
          <Button size="sm" variant="secondary" className="h-7" onClick={() => onOpen(c.id)}>
            Open
          </Button>
        </div>
      ))}
    </div>
  );
}
