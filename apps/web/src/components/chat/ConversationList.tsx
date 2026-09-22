import { useState } from 'react';
import { Hash, Plus, Search, AlertCircle, Trash2, MoreVertical } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/auth/useAuth';
import { useUiStore } from '@/store/uiStore';
import {
  useConversations,
  useDeleteConversation,
  useMarkChatRead,
  usePresence,
} from '@/hooks/useChat';
import type { Conversation } from '@/lib/types';
import { convTitle, initials, peerOf } from './chatUtils';

function UnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return (
    <Badge className="ml-auto h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px]">
      {count > 99 ? '99+' : count}
    </Badge>
  );
}

export function ConversationList() {
  const { user } = useAuth();
  const myId = user?.id ?? '';
  const { data: conversations, isLoading, isError, refetch } = useConversations();
  const activeId = useUiStore((s) => s.activeConversationId);
  const setActive = useUiStore((s) => s.setActiveConversationId);
  const setOverlay = useUiStore((s) => s.setChatOverlayOpen);
  const markRead = useMarkChatRead();
  const deleteConv = useDeleteConversation();
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const presence = usePresence();

  const channels = (conversations ?? []).filter((c) => c.type === 'CHANNEL');
  const dms = (conversations ?? []).filter((c) => c.type === 'DM');

  function select(conv: Conversation) {
    setActive(conv.id);
    if (conv.unreadCount) markRead.mutate(conv.id);
  }

  const rowBase =
    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-accent';

  return (
    <div className="flex w-72 shrink-0 flex-col border-r bg-background">
      <div className="flex items-center justify-between px-3 py-3">
        <h2 className="text-base font-semibold">Chat</h2>
        <Button size="sm" className="h-7 gap-1 px-2" onClick={() => setOverlay(true)}>
          <Plus className="size-3.5" /> New
        </Button>
      </div>
      <div className="px-3 pb-2">
        <button
          type="button"
          onClick={() => setOverlay(true)}
          className="flex w-full items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-1.5 text-sm text-muted-foreground hover:bg-muted"
        >
          <Search className="size-3.5" />
          Search people &amp; channels
        </button>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="px-2 pb-3">
          {isLoading && (
            <div className="space-y-2 px-1 pt-2" data-testid="conv-skeletons">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-8 w-full rounded-md" />
              ))}
            </div>
          )}

          {isError && (
            <div className="flex flex-col items-center gap-2 px-2 py-8 text-center text-sm text-muted-foreground">
              <AlertCircle className="size-5 text-destructive" />
              Couldn&apos;t load conversations.
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          )}

          {!isLoading && !isError && channels.length === 0 && dms.length === 0 && (
            <div className="flex flex-col items-center gap-2 px-3 py-10 text-center text-sm text-muted-foreground">
              No conversations yet.
              <Button variant="outline" size="sm" onClick={() => setOverlay(true)}>
                Start a DM or channel
              </Button>
            </div>
          )}

          {!isLoading && !isError && (channels.length > 0 || dms.length > 0) && (
            <>
              <GroupHeader label="Channels" onAdd={() => setOverlay(true)} />
              {channels.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => select(c)}
                  className={`${rowBase} ${activeId === c.id ? 'bg-accent font-medium' : ''}`}
                >
                  <Hash className="size-4 shrink-0 text-muted-foreground" />
                  <span className="truncate">{c.name ?? 'channel'}</span>
                  <UnreadBadge count={c.unreadCount ?? 0} />
                </button>
              ))}

              <GroupHeader label="Direct Messages" onAdd={() => setOverlay(true)} />
              {dms.map((c) => {
                const peer = peerOf(c, myId);
                const online = peer ? presence[peer.id] : false;
                return (
                  <div key={c.id} className="group relative">
                    <button
                      type="button"
                      onClick={() => select(c)}
                      className={`${rowBase} pr-8 ${activeId === c.id ? 'bg-accent font-medium' : ''}`}
                    >
                      <span className="relative shrink-0">
                        <Avatar className="size-6">
                          {peer?.imageUrl && <AvatarImage src={peer.imageUrl} />}
                          <AvatarFallback className="text-[10px]">
                            {peer ? initials(peer) : '?'}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background ${
                            online ? 'bg-green-500' : 'bg-muted-foreground/40'
                          }`}
                          aria-label={online ? 'online' : 'offline'}
                        />
                      </span>
                      <span className="truncate">{convTitle(c, myId)}</span>
                      <UnreadBadge count={c.unreadCount ?? 0} />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Conversation options"
                          className="absolute right-1 top-1/2 size-6 -translate-y-1/2 text-muted-foreground opacity-0 hover:text-muted-foreground focus:opacity-100 data-[state=open]:opacity-100 group-hover:opacity-100"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="size-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="min-w-48">
                        <DropdownMenuItem
                          variant="destructive"
                          className="whitespace-nowrap"
                          onSelect={() => setConfirmId(c.id)}
                        >
                          <Trash2 className="size-4" />
                          Delete conversation
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                );
              })}
            </>
          )}
        </div>
      </ScrollArea>

      <AlertDialog
        open={!!confirmId}
        onOpenChange={(o) => !o && setConfirmId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the conversation from your chat. The other person
              keeps it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteConv.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (confirmId)
                  deleteConv.mutate(confirmId, {
                    onSuccess: () => setConfirmId(null),
                  });
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function GroupHeader({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {label}
      <button type="button" onClick={onAdd} className="hover:text-foreground">
        <Plus className="size-3.5" />
      </button>
    </div>
  );
}
