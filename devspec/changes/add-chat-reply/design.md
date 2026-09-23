# Design: add-chat-reply

## Approach
Reply is a self-reference on `Message`: a nullable `replyToId` pointing at another `Message`. The preview shown in the UI is **live-included** (a shallow join on read), not a denormalized snapshot — so an edited parent shows through and a deleted parent can be detected via its `deletedAt`. Chosen over storing a body snapshot on the reply (rejected below).

The reply link threads through the existing send path unchanged in shape: `SendMessageDto` gains one optional field, `sendMessage` persists it and adds `replyTo` to the three existing `include` blocks so every payload — create broadcast, history page, edit broadcast — carries the preview. Frontend lifts a `replyTarget` into `MessageThread`, which already owns the message list and scroll container.

## Architecture

```
MessageRow [↩ Reply] ──setReplyTarget──▶ MessageThread (replyTarget state)
                                              │
                                              ▼
                                        Composer (reply banner)
                                              │ send.mutate({ body, replyToId, clientTempId })
                                              ▼
POST /chat/conversations/:id/messages ─▶ ChatController.send ─▶ ChatService.sendMessage
                                              │  validate replyToId ∈ conversation
                                              │  create Message{ replyToId }
                                              │  include replyTo{ id, body, deletedAt, author }
                                              ▼
                                        emitToConvo('chat:message', payload)
                                              │
        MessageThread ◀── socket / react-query ── payload.replyTo ──▶ MessageRow quoted parent
                                              │ click quoted ──▶ scrollIntoView(data-msg-id) + flash
```

## Data shape
`Message.replyToId String?` + self-relation `"MessageReplyTo"` (`replyTo` / `replies`), on-delete **SetNull**. See `db.md` for the full grid and migration verdict (additive, safe, no backfill, no index).

`replyTo` preview include (all 3 read sites):
```
replyTo: { select: { id: true, body: true, deletedAt: true, author: memberUserSelect } }
```
Shallow — no nested `replyTo`, no reactions/attachments on the preview. Deleted parent (`deletedAt != null`) → body blanked to `message deleted` at the render layer (mirrors existing `getMessages` deleted→`body:''` map at `chat.service.ts:330`).

Web `Message` type gains:
```
replyToId?: string | null;
replyTo?: { id: string; body: string; deletedAt: string | null; author: ChatUser } | null;
```

## Rejected approaches
- **Denormalized snapshot** (store `replyToBody`/`replyToAuthor` columns on the reply): avoids the join, but freezes a stale copy — edited parent wouldn't update, and deleted-parent handling would need extra flags. Live include is one cheap join and stays correct. Rejected.
- **`MessageReply` join table**: overkill — a message has exactly one parent, a nullable FK is the natural shape. Rejected.
- **Deep-history fetch-until-found on jump**: would page backward until the parent loads. Real complexity (loop + scroll-anchor restore) for an edge case; v1 no-ops instead. Deferred, not rejected.

## Impact Area

### Decision Defaults
| Gray area | Default | Why |
|-----------|---------|-----|
| Preview freshness | live include, no snapshot | edited parent stays accurate; one join |
| On-delete behavior | FK SetNull; soft-deleted parent → "message deleted" | chat soft-deletes; SetNull is the hard-delete safety net |
| Deleted parent body | blank → "message deleted" (italic) | never leak stale/soft-deleted text |
| Cross-conversation reply | reject in `sendMessage` (parent's conversationId must match) | a reply must anchor within its own channel |
| Parent not in loaded page | no-op (or small toast); no deep fetch | edge case; deep-history jump deferred |
| Reply on own vs others | both; DM + channel both | reply is universal, unlike channel-only mentions |
| `@@index([replyToId])` | none in v1 | no reply-thread query yet |
| Optimistic send preview | client builds `replyTo` from the target it already holds | banner already has name+body; no refetch |
| Nested reply depth | shallow (1 level preview) | flat inline quote; no thread view |

### Blast Radius
- `apps/api/prisma/schema.prisma:1263` `Message` — add column + self-relation (migration).
- `apps/api/src/chat/dto/send-message.dto.ts` — add optional `replyToId`.
- `apps/api/src/chat/chat.service.ts` — `sendMessage` (`:266`) persist + validate; add `replyTo` include at create (`:277`), findMany (`:322`), update (`:351`); deleted-parent guard near existing map (`:330`).
- `apps/api/src/chat/chat.controller.ts:53` / `chat.gateway.ts:130` — thread `replyToId` through send.
- `apps/web/src/lib/types.ts:1592` `Message` — add `replyToId` + `replyTo`.
- `apps/web/src/components/chat/MessageRow.tsx` — reply btn + quoted parent render.
- `apps/web/src/components/chat/Composer.tsx:118` — reply banner + `replyToId` in `send.mutate`.
- `apps/web/src/components/chat/MessageThread.tsx` — `replyTarget` state, scroll anchors, scroll-to + flash.
- `apps/web/src/hooks/useChat.ts` — send mutation passes `replyToId`; optimistic message carries local `replyTo` preview.

### Risk tags
- **reversibility**: high — additive column (SetNull), no data reshape; revert = drop column.
- **risk**: low-medium — touches the hot send path + 3 include sites; regression risk on existing chat tests, covered by no-regression verify.
- **shared-state**: `Message` table is chat-only; no other feature writes it. File overlap with `chat-members-mentions` (done) on `MessageRow`/`Composer`, no req conflict.
