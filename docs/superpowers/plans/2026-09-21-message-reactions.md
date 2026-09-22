# Message Reactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let chat users react to messages with emojis, shown as grouped pills with a who-reacted tooltip.

**Architecture:** Reactions ride the existing edit/delete path — a REST mutation writes the DB, then `ChatService.emitToConvo` broadcasts a `chat:message:reaction` socket event; clients reconcile the react-query messages cache. Reactions are included in message reads so history loads with reactor names.

**Tech Stack:** NestJS + Prisma (api), React + @tanstack/react-query + socket.io-client (web), emoji-mart (already installed), shadcn Tooltip/Popover.

## Global Constraints

- No new dependencies — `emoji-mart`, `@emoji-mart/react`, `@emoji-mart/data` already in `apps/web/package.json`.
- One user may hold multiple distinct emojis on one message; unique key `(messageId, userId, emoji)`.
- Emoji is a validated string: non-empty, `length <= 16`.
- Reuse `memberUserSelect` for any user subset returned from the api.
- Match existing chat patterns (edit/delete mutation, `markFailed` cache helper, socket on/off in `useChatSync`).
- Commit after each task.

---

### Task 1: Prisma model + migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (Message model + new MessageReaction model + User back-relation)

**Interfaces:**
- Produces: `MessageReaction` table with columns `id, messageId, userId, emoji, createdAt`; `Message.reactions` relation.

- [ ] **Step 1: Add the model and relations**

In `apps/api/prisma/schema.prisma`, inside `model Message { ... }` add to the relations block:
```prisma
  reactions    MessageReaction[]
```

Add the new model after `model Message`:
```prisma
model MessageReaction {
  id        String   @id @default(cuid())
  messageId String
  userId    String
  emoji     String
  createdAt DateTime @default(now())

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([messageId, userId, emoji])
  @@index([messageId])
}
```

In `model User { ... }` add a back-relation line alongside the other relations:
```prisma
  messageReactions MessageReaction[]
```

- [ ] **Step 2: Create the migration**

Run: `cd apps/api && pnpm prisma migrate dev --name message_reactions`
Expected: migration created, `MessageReaction` table applied, Prisma client regenerated with no errors.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "feat(chat): MessageReaction model and migration"
```

---

### Task 2: Service — toggleReaction + include reactions in reads

**Files:**
- Modify: `apps/api/src/chat/chat.service.ts`
- Test: `apps/api/src/chat/chat.service.spec.ts` (create if absent)

**Interfaces:**
- Consumes: Task 1 `MessageReaction` table; existing `assertMember`, `emitToConvo`, `memberUserSelect`.
- Produces: `toggleReaction(messageId: string, userId: string, emoji: string): Promise<MessageReaction[]>`; socket event `chat:message:reaction` payload `{ messageId, reactions }`.

- [ ] **Step 1: Write the failing test**

Create/extend `apps/api/src/chat/chat.service.spec.ts`. Use a Prisma mock consistent with the repo's other `*.service.spec.ts` (copy the mocking style from an existing chat/other service spec). Core assertions:
```ts
describe('toggleReaction', () => {
  it('creates a reaction when none exists, then removes it on repeat', async () => {
    // message exists + user is a member (mock findUnique for message, membership)
    // 1st call: reaction findUnique -> null  => expect prisma.messageReaction.create called
    // 2nd call: reaction findUnique -> row   => expect prisma.messageReaction.delete called
    // both return the re-read reactions array and emit 'chat:message:reaction'
  });

  it('throws BadRequestException for empty or oversized emoji', async () => {
    await expect(service.toggleReaction('m1', 'u1', '')).rejects.toThrow(BadRequestException);
    await expect(service.toggleReaction('m1', 'u1', 'x'.repeat(17))).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm test chat.service`
Expected: FAIL — `toggleReaction is not a function`.

- [ ] **Step 3: Implement toggleReaction and add reactions to reads**

In `chat.service.ts`, add the method (place near `editMessage`):
```ts
async toggleReaction(messageId: string, userId: string, emoji: string) {
  if (!emoji || emoji.length > 16) {
    throw new BadRequestException('Invalid emoji');
  }
  const message = await this.prisma.message.findUnique({
    where: { id: messageId },
    select: { id: true, conversationId: true },
  });
  if (!message) throw new NotFoundException('Message not found');
  await this.assertMember(message.conversationId, userId);

  const existing = await this.prisma.messageReaction.findUnique({
    where: { messageId_userId_emoji: { messageId, userId, emoji } },
  });
  if (existing) {
    await this.prisma.messageReaction.delete({ where: { id: existing.id } });
  } else {
    await this.prisma.messageReaction.create({ data: { messageId, userId, emoji } });
  }

  const reactions = await this.prisma.messageReaction.findMany({
    where: { messageId },
    include: { user: memberUserSelect },
  });
  this.emitToConvo(message.conversationId, 'chat:message:reaction', {
    messageId,
    reactions,
  });
  return reactions;
}
```

Add `reactions: { include: { user: memberUserSelect } }` to the `include` of the three message reads so the UI always gets reactions:
- `getMessages` read (currently `include: { author: memberUserSelect, attachments: true }`)
- `editMessage` re-read (currently `include: { author: memberUserSelect }`)
- `sendMessage` read (currently `include: { author: memberUserSelect, attachments: true }`)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && pnpm test chat.service`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/chat/chat.service.ts apps/api/src/chat/chat.service.spec.ts
git commit -m "feat(chat): toggleReaction service + reactions in message reads"
```

---

### Task 3: Controller route

**Files:**
- Modify: `apps/api/src/chat/chat.controller.ts`
- Create: `apps/api/src/chat/dto/react-message.dto.ts`

**Interfaces:**
- Consumes: Task 2 `ChatService.toggleReaction`.
- Produces: `POST /chat/messages/:id/reactions` body `{ emoji: string }` returning `MessageReaction[]`.

- [ ] **Step 1: Create the DTO**

Create `apps/api/src/chat/dto/react-message.dto.ts` (mirror `EditMessageDto` validators):
```ts
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class ReactMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(16)
  emoji!: string;
}
```

- [ ] **Step 2: Add the route**

In `chat.controller.ts`, import `ReactMessageDto` and add after the `@Delete('messages/:id')` handler:
```ts
  @Post('messages/:id/reactions')
  react(@Req() req: any, @Param('id') id: string, @Body() dto: ReactMessageDto) {
    return this.chatService.toggleReaction(id, req.user.id, dto.emoji);
  }
```

- [ ] **Step 3: Build to verify**

Run: `cd apps/api && pnpm build`
Expected: build succeeds, no type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/chat/chat.controller.ts apps/api/src/chat/dto/react-message.dto.ts
git commit -m "feat(chat): POST reactions route"
```

---

### Task 4: Frontend types + api client

**Files:**
- Modify: `apps/web/src/lib/types.ts`
- Modify: `apps/web/src/lib/api.ts`

**Interfaces:**
- Produces: `MessageReaction` type; `Message.reactions?`; `api.reactToChatMessage(id, emoji): Promise<MessageReaction[]>`.

- [ ] **Step 1: Add the type**

In `apps/web/src/lib/types.ts`, add before `export interface Message`:
```ts
export interface MessageReaction {
  id: string;
  messageId: string;
  emoji: string;
  userId: string;
  user: ChatUser;
}
```
Add to `interface Message` (after `attachments?`):
```ts
  reactions?: MessageReaction[];
```

- [ ] **Step 2: Add the api method**

In `apps/web/src/lib/api.ts`, add next to `deleteChatMessage`:
```ts
  reactToChatMessage: (id: string, emoji: string) =>
    request<MessageReaction[]>(`/chat/messages/${id}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),
```
Ensure `MessageReaction` is imported in the types import block if the file imports named types.

- [ ] **Step 3: Typecheck**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: no new type errors.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/types.ts apps/web/src/lib/api.ts
git commit -m "feat(chat): reaction types + api client method"
```

---

### Task 5: Cache helper, hook, socket sync

**Files:**
- Modify: `apps/web/src/hooks/useChat.ts`
- Modify: `apps/web/src/hooks/useChatSync.ts`
- Test: `apps/web/src/hooks/reactions.util.test.ts` (create)
- Create: `apps/web/src/hooks/reactions.util.ts`

**Interfaces:**
- Consumes: Task 4 `api.reactToChatMessage`, `MessageReaction`, `chatKeys.messages`, existing `Infinite`/`markFailed` pattern in `useChat.ts`.
- Produces: `upsertReactions(data, messageId, reactions)`; `toggleReactionLocal(data, messageId, emoji, user)`; `useReactMessage()`; socket handler for `chat:message:reaction`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/hooks/reactions.util.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { upsertReactions, toggleReactionLocal } from './reactions.util';
import type { MessageReaction } from '../lib/types';

const page = (msgs: any[]) => ({ pages: [{ items: msgs, nextCursor: null }], pageParams: [undefined] });
const u = { id: 'u1', name: 'Al', username: 'al', email: 'a@a', imageUrl: null } as any;

describe('reactions util', () => {
  it('upsertReactions replaces the reactions of the target message only', () => {
    const data = page([{ id: 'm1', reactions: [] }, { id: 'm2', reactions: [] }]);
    const rx: MessageReaction[] = [{ id: 'r1', messageId: 'm1', emoji: '👍', userId: 'u1', user: u }];
    const out = upsertReactions(data as any, 'm1', rx);
    expect(out.pages[0].items[0].reactions).toEqual(rx);
    expect(out.pages[0].items[1].reactions).toEqual([]);
  });

  it('toggleReactionLocal adds then removes my emoji', () => {
    const data = page([{ id: 'm1', reactions: [] }]);
    const added = toggleReactionLocal(data as any, 'm1', '👍', u);
    expect(added.pages[0].items[0].reactions).toHaveLength(1);
    const removed = toggleReactionLocal(added as any, 'm1', '👍', u);
    expect(removed.pages[0].items[0].reactions).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run src/hooks/reactions.util.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the util**

Create `apps/web/src/hooks/reactions.util.ts`:
```ts
import type { InfiniteData } from '@tanstack/react-query';
import type { MessagePage, MessageReaction, ChatUser } from '../lib/types';

type Infinite = InfiniteData<MessagePage>;

function mapMessage(
  data: Infinite,
  messageId: string,
  fn: (rx: MessageReaction[]) => MessageReaction[],
): Infinite {
  return {
    ...data,
    pages: data.pages.map((p) => ({
      ...p,
      items: p.items.map((m) =>
        m.id === messageId ? { ...m, reactions: fn(m.reactions ?? []) } : m,
      ),
    })),
  };
}

export function upsertReactions(
  data: Infinite,
  messageId: string,
  reactions: MessageReaction[],
): Infinite {
  return mapMessage(data, messageId, () => reactions);
}

/** Optimistic local toggle for the current user; server broadcast reconciles. */
export function toggleReactionLocal(
  data: Infinite,
  messageId: string,
  emoji: string,
  user: ChatUser,
): Infinite {
  return mapMessage(data, messageId, (rx) => {
    const mine = rx.find((r) => r.userId === user.id && r.emoji === emoji);
    if (mine) return rx.filter((r) => r !== mine);
    return [
      ...rx,
      { id: `tmp-${emoji}-${user.id}`, messageId, emoji, userId: user.id, user },
    ];
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run src/hooks/reactions.util.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the hook**

In `apps/web/src/hooks/useChat.ts`, import the util and `MessageReaction`, then add (mirror `useEditMessage` optimistic style; `myId` from `useAuth`, `qc` from `useQueryClient`):
```ts
export function useReactMessage(conversationId: string) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = chatKeys.messages(conversationId);
  return useMutation({
    mutationFn: ({ id, emoji }: { id: string; emoji: string }) =>
      api.reactToChatMessage(id, emoji),
    onMutate: async ({ id, emoji }) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<Infinite>(key);
      if (prev && user) {
        qc.setQueryData<Infinite>(key, toggleReactionLocal(prev, id, emoji, user as any));
      }
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast.error(err instanceof Error ? err.message : 'Failed to react');
    },
    onSuccess: (reactions, { id }) => {
      const cur = qc.getQueryData<Infinite>(key);
      if (cur) qc.setQueryData<Infinite>(key, upsertReactions(cur, id, reactions));
    },
  });
}
```
(If `Infinite` is a local type alias in `useChat.ts`, reuse it; otherwise import from the util file.)

- [ ] **Step 6: Add socket sync**

In `apps/web/src/hooks/useChatSync.ts`, import `upsertReactions`, add a handler and register/unregister it next to the other message handlers:
```ts
const onReaction = ({ messageId, reactions }: { messageId: string; reactions: MessageReaction[] }) => {
  // find which conversation this message belongs to via existing cache; mirror onUpdated's cache-write approach
  // update the messages infinite cache with upsertReactions(cur, messageId, reactions)
};
socket.on('chat:message:reaction', onReaction);
// in cleanup:
socket.off('chat:message:reaction', onReaction);
```
Follow exactly how `onUpdated` locates the conversation key and writes the cache in this file (reuse that resolution — do not invent a new lookup).

- [ ] **Step 7: Typecheck + tests**

Run: `cd apps/web && pnpm tsc --noEmit && pnpm vitest run src/hooks/reactions.util.test.ts`
Expected: no type errors, tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/hooks/useChat.ts apps/web/src/hooks/useChatSync.ts apps/web/src/hooks/reactions.util.ts apps/web/src/hooks/reactions.util.test.ts
git commit -m "feat(chat): reaction cache helper, mutation hook, socket sync"
```

---

### Task 6: UI — ReactionBar, picker, tooltip

**Files:**
- Create: `apps/web/src/components/chat/ReactionBar.tsx`
- Modify: `apps/web/src/components/chat/MessageThread.tsx`

**Interfaces:**
- Consumes: Task 5 `useReactMessage`; `MessageReaction`; shadcn `Tooltip`, `Popover`; `emoji-mart`.
- Produces: `<ReactionBar message={m} myId={myId} convId={convId} />` rendered under each non-deleted message bubble.

- [ ] **Step 1: Group util + names (pure, testable)**

Add to `apps/web/src/components/chat/ReactionBar.tsx` a pure helper and cover it in the existing reactions test file:
```ts
export function groupReactions(reactions: MessageReaction[] = []) {
  const map = new Map<string, MessageReaction[]>();
  for (const r of reactions) {
    (map.get(r.emoji) ?? map.set(r.emoji, []).get(r.emoji)!).push(r);
  }
  return [...map.entries()].map(([emoji, rows]) => ({ emoji, rows }));
}

export function reactorNames(rows: MessageReaction[], myId: string) {
  const names = rows.map((r) => (r.userId === myId ? 'you' : r.user.name || r.user.username));
  if (names.length <= 2) return names.join(' and ');
  return `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;
}
```
Add to `reactions.util.test.ts`:
```ts
import { groupReactions, reactorNames } from '../components/chat/ReactionBar';
it('groups by emoji and formats reactor names', () => {
  const rx: any = [
    { emoji: '👍', userId: 'u1', user: { name: 'Al' } },
    { emoji: '👍', userId: 'u2', user: { name: 'Bo' } },
  ];
  expect(groupReactions(rx)).toHaveLength(1);
  expect(reactorNames(rx, 'u1')).toBe('you and Bo');
});
```
Run: `cd apps/web && pnpm vitest run src/hooks/reactions.util.test.ts` → PASS.

- [ ] **Step 2: Build ReactionBar component**

In `ReactionBar.tsx`, render the pills + add control. Quick-bar const and structure:
```tsx
import { useState } from 'react';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';
import { SmilePlus } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useReactMessage } from '@/hooks/useChat';
import type { Message, MessageReaction } from '@/lib/types';

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

export function ReactionBar({ message, myId, convId }: { message: Message; myId: string; convId: string }) {
  const react = useReactMessage(convId);
  const [open, setOpen] = useState(false);
  const groups = groupReactions(message.reactions);
  const toggle = (emoji: string) => react.mutate({ id: message.id, emoji });

  return (
    <div className="mt-1 flex flex-wrap items-center gap-1">
      {groups.map(({ emoji, rows }) => {
        const mine = rows.some((r) => r.userId === myId);
        return (
          <Tooltip key={emoji}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => toggle(emoji)}
                className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${mine ? 'border-primary bg-primary/10' : 'border-border bg-muted'}`}
              >
                <span>{emoji}</span>
                <span>{rows.length}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>{reactorNames(rows, myId)}</TooltipContent>
          </Tooltip>
        );
      })}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label="Add reaction">
            <SmilePlus className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2">
          <div className="mb-2 flex gap-1">
            {QUICK_EMOJIS.map((e) => (
              <button key={e} type="button" className="rounded p-1 text-lg hover:bg-muted"
                onClick={() => { toggle(e); setOpen(false); }}>
                {e}
              </button>
            ))}
          </div>
          <Picker data={data} onEmojiSelect={(e: { native: string }) => { toggle(e.native); setOpen(false); }} theme="auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

- [ ] **Step 3: Wire into MessageThread**

In `MessageThread.tsx`, import `ReactionBar`. In `MessageThreadView`, inside each message row where the bubble renders (the `own`/message block around lines 200-220), render below the bubble body only for non-deleted messages:
```tsx
{!m.deletedAt && <ReactionBar message={m} myId={myId} convId={m.conversationId} />}
```
Place it inside the same column container as the bubble so it aligns under the text. Confirm `myId` and the per-message `m` are in scope at that point (they are — `MessageThreadView` receives `myId` and maps `m`).

- [ ] **Step 4: Typecheck + build the web app**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: no type errors.

- [ ] **Step 5: Manual runtime check**

Start the app (api + web), open a conversation in two browser sessions:
- Click smiley → quick-bar → 👍: pill appears with count 1 in both windows.
- Hover pill → tooltip shows the reactor ("you" in one, the name in the other).
- Click your own 👍 pill → count drops / pill disappears in both.
- "+" picker → pick any emoji → new pill appears.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/components/chat/ReactionBar.tsx apps/web/src/components/chat/MessageThread.tsx apps/web/src/hooks/reactions.util.test.ts
git commit -m "feat(chat): reaction bar UI with quick-bar, picker, who-reacted tooltip"
```

---

## Self-Review notes

- Spec §1 → Task 1. §2 → Tasks 2–3. §3 types/api → Task 4; hook/cache/sync → Task 5; UI → Task 6. Testing section → service spec (Task 2) + pure util tests (Tasks 5–6). All covered.
- Names consistent across tasks: `toggleReaction`, `reactToChatMessage`, `upsertReactions`, `toggleReactionLocal`, `groupReactions`, `reactorNames`, `useReactMessage`, event `chat:message:reaction`.
- `useChatSync` conversation-key resolution intentionally defers to the file's existing `onUpdated` pattern rather than inventing one (Task 5 Step 6).
