import { useMemo, useState } from 'react';
import { LogOut, Plus, Search, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
  useSearchChatTargets,
  useAddChatMembers,
  useRemoveChatMember,
  useDeleteConversation,
} from '@/hooks/useChat';
import type { Conversation } from '@/lib/types';
import { initials } from './chatUtils';

type ChatTarget = {
  id: string;
  name: string | null;
  username: string;
  imageUrl: string | null;
};

/**
 * Channel-only members pill + panel: view members, add (any member),
 * remove (owner only), leave. DM threads never render this.
 */
export function MembersPanel({
  conversation,
  myId,
}: {
  conversation: Conversation;
  myId: string;
}) {
  const members = conversation.members ?? [];
  const isOwner = members.some((m) => m.userId === myId && m.role === 'owner');
  const memberIds = useMemo(() => new Set(members.map((m) => m.userId)), [members]);

  const [query, setQuery] = useState('');
  const [removeTarget, setRemoveTarget] = useState<{ id: string; name: string } | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const { data: results } = useSearchChatTargets(query);
  const addMembers = useAddChatMembers();
  const removeMember = useRemoveChatMember();
  const leave = useDeleteConversation();

  const suggestions = ((results ?? []) as ChatTarget[]).filter(
    (r) => !memberIds.has(r.id),
  );

  const preview = members.slice(0, 3);

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto h-8 gap-1.5 rounded-full pl-1.5"
            aria-label="View members"
          >
            <span className="flex -space-x-2">
              {preview.map((m) => (
                <Avatar key={m.userId} className="size-5 ring-2 ring-background">
                  {m.user.imageUrl && <AvatarImage src={m.user.imageUrl} />}
                  <AvatarFallback className="text-[8px]">
                    {initials(m.user)}
                  </AvatarFallback>
                </Avatar>
              ))}
            </span>
            <span className="text-xs font-medium">{members.length}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-80 p-0">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">Members · {members.length}</span>
          </div>
          <div className="p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Add people by name or username"
                className="pl-8"
              />
            </div>

            {query.trim() && (
              <div className="mt-2">
                <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Add to channel
                </p>
                {suggestions.length === 0 ? (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                    No teammates found for “{query.trim()}”.
                  </p>
                ) : (
                  <div className="max-h-40 space-y-0.5 overflow-y-auto">
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        disabled={addMembers.isPending}
                        onClick={() =>
                          addMembers.mutate(
                            { id: conversation.id, userIds: [s.id] },
                            { onSuccess: () => setQuery('') },
                          )
                        }
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent"
                      >
                        <Plus className="size-4 text-muted-foreground" />
                        <Avatar className="size-6">
                          {s.imageUrl && <AvatarImage src={s.imageUrl} />}
                          <AvatarFallback className="text-[10px]">{initials(s)}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate text-sm">{s.name ?? s.username}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-2 max-h-64 space-y-0.5 overflow-y-auto">
              {members.map((m) => {
                const me = m.userId === myId;
                const owner = m.role === 'owner';
                const canRemove = isOwner && !me && !owner;
                return (
                  <div
                    key={m.userId}
                    className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent/60"
                  >
                    <Avatar className="size-7">
                      {m.user.imageUrl && <AvatarImage src={m.user.imageUrl} />}
                      <AvatarFallback className="text-[10px]">{initials(m.user)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{m.user.name ?? m.user.username}</p>
                      <p className="truncate text-xs text-muted-foreground">@{m.user.username}</p>
                    </div>
                    {(me || owner) && (
                      <Badge variant="secondary" className="shrink-0">
                        {me && owner ? 'You · Owner' : me ? 'You' : 'Owner'}
                      </Badge>
                    )}
                    {canRemove && (
                      <button
                        type="button"
                        onClick={() =>
                          setRemoveTarget({ id: m.userId, name: m.user.name ?? m.user.username })
                        }
                        aria-label={`Remove ${m.user.name ?? m.user.username}`}
                        className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition hover:text-destructive group-hover:opacity-100"
                      >
                        <X className="size-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-2 border-t pt-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start gap-2 text-destructive hover:text-destructive"
                onClick={() => setConfirmLeave(true)}
              >
                <LogOut className="size-4" /> Leave channel
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Remove member confirm (owner only) */}
      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removeTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They’ll lose access to this channel and its history. You can add them
              back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removeMember.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (!removeTarget) return;
                removeMember.mutate(
                  { id: conversation.id, userId: removeTarget.id },
                  { onSuccess: () => setRemoveTarget(null) },
                );
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Leave confirm */}
      <AlertDialog open={confirmLeave} onOpenChange={(o) => !o && setConfirmLeave(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave channel?</AlertDialogTitle>
            <AlertDialogDescription>
              You’ll stop receiving its messages. You can be added back later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={leave.isPending}
              onClick={(e) => {
                e.preventDefault();
                leave.mutate(conversation.id, { onSuccess: () => setConfirmLeave(false) });
              }}
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
