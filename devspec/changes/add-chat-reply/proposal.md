# Proposal: add-chat-reply

## Why
The real-time chat (`add-realtime-chat`, `add-realtime-chat-web`) supports send, edit, delete, reactions, attachments, and @mentions — but there's no way to **reply to a specific message**. In an active channel, threads of context get lost: a reply reads as a floating statement with no anchor to what it answers. Users want to reply to a message and have the UI show which message they replied to.

## What this delivers
- **Reply from any message** — a `Reply` action in the message hover toolbar (own and others', DM and channel).
- **Quoted parent** — a reply renders a compact quoted preview above its body: the original author + a one-line snippet, so the referenced message is visible inline.
- **Composer reply banner** — picking Reply pins a "Replying to <name>: <preview>" banner above the input, cancelable with ✕ or Escape.
- **Jump to original** — clicking the quoted preview scrolls to the original message and flashes it.
- **Durable** — the reply link persists (a real self-FK on `Message`), so it survives reload and rides the real-time broadcast.

## Scope — in
- **DB**: additive nullable self-FK `Message.replyToId` (self-relation, on-delete SetNull). One Prisma migration. No backfill, no index (v1).
- **Backend**: `SendMessageDto.replyToId`; `sendMessage` persists it, validates the parent is in the same conversation, and includes a shallow `replyTo` preview in the 3 message read/broadcast sites; deleted-parent guard so the preview shows "message deleted".
- **Frontend**: reply button in `MessageRow` toolbar; quoted-parent render above the bubble (live, deleted-aware); `Composer` reply banner + `replyToId` in send payload; `MessageThread` owns reply-target state, message scroll anchors, and scroll-to-original + highlight; optimistic-send carries a local `replyTo` preview.

## Scope — out
- **Threaded/nested view** ("N replies" collapsible sub-threads) — v1 is flat inline quote only.
- **Deep-history jump** — if the original is in an unloaded older page, click is a no-op (or a small toast); fetch-until-found is deferred.
- **Reply notifications** — no `chat:reply` toast/notification event; mentions already cover call-outs.
- **`@@index([replyToId])`** — no reply-thread query in v1; add when thread view ships.
- No destructive DB ops; no change to edit/delete/reaction behavior.

## Relationship to other changes
- `chat-members-mentions` (board: blocked on BA sign-off, code done) touches `Message.body` render only — no schema or req overlap. `depends_on: []`. Both edit `MessageRow`/`Composer`; reply builds on the merged mention render, does not conflict.
