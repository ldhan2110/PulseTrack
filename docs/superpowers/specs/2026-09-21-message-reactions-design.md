# Message Reactions — Design

Date: 2026-09-21
Branch: feat/chat-member-feature

## Goal

Let a chat user react to any message with an emoji. Reactions show as grouped
pills (emoji + count) under the message bubble. Hovering a pill shows who
reacted. A user picks from a 6-emoji quick-bar or a full emoji picker.

## Decisions

- **Q1** — Quick-bar of 6 fixed emojis (👍 ❤️ 😂 😮 😢 🎉) + "+" opens full
  `emoji-mart` picker (already installed; no new dep).
- **Q2** — Multiple different emojis allowed per user per message. Unique key
  `(messageId, userId, emoji)`.
- **Q3** — Who-reacted shown via hover tooltip on each pill ("Alice, Bob and you").

Reactions ride the same architecture as edit/delete: REST mutation → DB →
`emitToConvo` socket broadcast → clients reconcile react-query cache.

## §1 Data model

New Prisma model in `apps/api/prisma/schema.prisma`:

```prisma
model MessageReaction {
  id        String   @id @default(cuid())
  messageId String
  userId    String
  emoji     String   // unicode char, e.g. "👍"
  createdAt DateTime @default(now())

  message Message @relation(fields: [messageId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([messageId, userId, emoji])
  @@index([messageId])
}
```

- Add `reactions MessageReaction[]` to `Message`.
- Add back-relation `messageReactions MessageReaction[]` to `User`.
- Migration via prisma migrate.
- Every message read that returns messages to the UI (`getMessages`,
  `sendMessage`, `editMessage`) adds `reactions: { include: { user: memberUserSelect } }`
  so the client always has reactor names for the tooltip.

## §2 API + socket

**Controller** (`chat.controller.ts`) — new route mirroring `@Patch('messages/:id')`:

```
POST /chat/messages/:id/reactions   body { emoji: string }
```

**Service** `ChatService.toggleReaction(messageId, userId, emoji)`:
1. Load message → `NotFoundException` if missing; `assertMember(conversationId, userId)`.
2. Validate emoji: non-empty string, `length <= 16` → else `BadRequestException`.
3. Toggle: `findUnique` on `(messageId, userId, emoji)`; if present `delete`, else `create`.
4. Re-read the message's reactions (`include: { user: memberUserSelect }`).
5. `emitToConvo(conversationId, 'chat:message:reaction', { messageId, reactions })`.
6. Return `reactions`.

New socket event `chat:message:reaction` joins the existing set
(`new` / `updated` / `deleted` / `read`). Payload `{ messageId, reactions: MessageReaction[] }`.

## §3 Frontend

**Types** (`lib/types.ts`):
```ts
export interface MessageReaction {
  id: string;
  messageId: string;
  emoji: string;
  userId: string;
  user: ChatUser;
}
```
Add `reactions?: MessageReaction[]` to `Message`.

**API client** (`lib/api.ts`):
```ts
reactToChatMessage: (id: string, emoji: string) =>
  request<MessageReaction[]>(`/chat/messages/${id}/reactions`, {
    method: 'POST', body: JSON.stringify({ emoji }),
  }),
```

**Hook** (`hooks/useChat.ts`):
- `useReactMessage()` — `mutationFn: ({id, emoji}) => api.reactToChatMessage(id, emoji)`.
- Optimistic: on mutate, toggle the emoji for `myId` in the messages infinite
  cache via a new `upsertReactions`/`toggleReactionLocal` helper (mirrors
  `markFailed`). Server broadcast is source of truth and reconciles.
- On error: rollback + `toast.error`.

**Cache helper**: `upsertReactions(data: Infinite, messageId, reactions)` replaces
the `reactions` array of the matching message across infinite pages.

**Socket sync** (`hooks/useChatSync.ts`): add
`socket.on('chat:message:reaction', ({ messageId, reactions }) => upsertReactions(...))`
and matching `socket.off` in cleanup.

**UI** (`components/chat/MessageThread.tsx`, `MessageThreadView` row):
- **ReactionBar** under each non-deleted bubble: group `reactions` by emoji →
  pill `{emoji} {count}`. Pill highlighted (ring/accent bg) when `myId` is in the
  group. Click pill → `useReactMessage` toggle. Wrap pill in shadcn `Tooltip`;
  content = reactor names, own id rendered as "you".
- **Add-reaction control**: smiley button appears on message hover (same hover
  affordance as edit/delete). Opens shadcn `Popover` containing:
  - quick-bar: 6 hardcoded emojis (`QUICK_EMOJIS` const), click toggles.
  - "+" → `emoji-mart` `Picker` (`@emoji-mart/react` + `@emoji-mart/data`), on
    select toggles + closes popover.
- Deleted messages (`deletedAt`) show no reactions and no add control.

New small components kept in `MessageThread.tsx` or a sibling
`ReactionBar.tsx`/`ReactionPicker.tsx` to keep the file focused.

## Testing

- Service: unit/e2e — toggle adds then removes same emoji; two different emojis
  from one user coexist; non-member `ForbiddenException`; oversized emoji
  `BadRequestException`.
- Frontend: unit test for the group-by-emoji + "who reacted" name builder
  (pure function).

## Out of scope

- Reaction notifications.
- Animated reaction effects.
- Reaction analytics / most-used ordering (quick-bar is fixed order).
