# Tasks: add-chat-reply

## 1. Schema + migration [req-1]
- [x] 1.1 [db] Add `replyToId String?` to `Message` (`apps/api/prisma/schema.prisma:1263`) with self-relation `replyTo Message? @relation("MessageReplyTo", fields:[replyToId], references:[id], onDelete: SetNull)` + `replies Message[] @relation("MessageReplyTo")`. No index (per db.md).
- [x] 1.2 [db] Generate Prisma migration `apps/api/prisma/migrations/20260923010000_add_chat_reply/migration.sql` (additive: `ALTER TABLE "Message" ADD COLUMN "replyToId" TEXT` + FK). No backfill, no destructive op.
- [x] 1.3 [backend] Run `pnpm generate` so the Prisma client picks up `replyToId`/`replyTo`. (client regenerated, v7.6.0)
Verify: `pnpm --filter @pm/api exec prisma migrate diff` clean against schema; migration applies on scratch DB; `Message.replyToId` exists as nullable text FK→Message on-delete SetNull. — ⚠️ ENV-BLOCKED: migration file written + client generated, but apply-on-DB not runnable (shared dev DB off-limits + diverged, no scratch DB, rtk migrate engine absent). Human applies migration. See report/blockers.md.

## 2. Send DTO + persist + guard [req-1, req-2]
- [x] 2.1 [backend] Add optional `replyToId?: string` (`@IsOptional @IsString`) to `SendMessageDto` (`apps/api/src/chat/dto/send-message.dto.ts`).
- [x] 2.2 [backend] Thread `replyToId` through `ChatController.send` (`chat.controller.ts:53`) and `ChatGateway` `chat:send` (`chat.gateway.ts:130`) into `ChatService.sendMessage` (new param).
- [x] 2.3 [service] In `sendMessage` (`chat.service.ts:266`): if `replyToId` set, `findUnique({where:{id:replyToId}, select:{conversationId:true}})`; reject with `BadRequestException` when missing or `conversationId` mismatches. Then `create` with `replyToId`.
- [x] 2.4 [test] `chat.service` test: reply in same convo persists `replyToId`; cross-convo `replyToId` → 400; no `replyToId` → null.
Verify: `pnpm --filter @pm/api test -- chat.service` — ✅ PASS (140 tests green, +6 new).

## 3. Reply preview include + deleted guard [req-3, req-4]
- [x] 3.1 [service] Add `replyTo: { select: { id:true, body:true, deletedAt:true, author: memberUserSelect } }` to the 3 include blocks: create (`chat.service.ts:277`), `getMessages` findMany (`:322`), `editMessage` update (`:351`).
- [x] 3.2 [service] Blank a deleted parent: where a row's `replyTo?.deletedAt` is set, replace `replyTo.body` with `''` (shared `stripDeletedReply` helper applied at all 3 read sites) so the client shows "message deleted".
- [x] 3.3 [test] `chat.service` test: replying message returned from `getMessages` carries `replyTo{id,body,author}`; parent soft-deleted → `replyTo.body === ''`.
Verify: `pnpm --filter @pm/api test -- chat.service` — ✅ PASS.

## 4. Web types [req-3]
- [x] 4.1 [frontend] Add `replyToId?: string | null` and `replyTo?: { id:string; body:string; deletedAt:string|null; author:ChatUser } | null` to `Message` (`apps/web/src/lib/types.ts:1592`).
Verify: `pnpm --filter @pm/web build` (tsc) clean. — ✅ PASS (build ok).

## 5. Composer reply banner + send payload [req-5]
- [x] 5.1 [frontend] `MessageThread` owns `replyTarget: Message | null` state; passes `replyTarget`/`onCancelReply` to `Composer`, `onSetReply`/`onQuoteClick` down to `MessageRow` (via `MessageThreadView` → `MessageGroup`).
- [x] 5.2 [frontend] `Composer` renders the reply banner when `replyTarget` set: "Replying to <author>: <truncated body>" + ✕. Escape and ✕ call `onCancelReply`.
- [x] 5.3 [frontend] On send, includes `replyToId: replyTarget?.id` in `send.mutate({...})`; clears `replyTarget` after send.
- [x] 5.4 [frontend] `useChat` send mutation accepts `replyToId` + `replyTo`, sends `replyToId` to the API; optimistic message carries the local `replyTo` preview from the passed target (no refetch).
Verify: `/devspec-verify add-chat-reply` — ⚠️ ENV-BLOCKED: code done + web build clean + Composer/useChat unit tests pass, but live browser verify needs the app running against a DB with `replyToId` (migration unapplied). Runs after human applies migration.

## 6. Reply action + quoted parent render [req-5, req-6]
- [x] 6.1 [frontend] `MessageRow`: `Reply` button added to the hover toolbar; others' messages get a toolbar too. Click → `onSetReply(message)`.
- [x] 6.2 [frontend] `MessageRow`: when `m.replyTo` present, renders the quoted-parent block above the bubble — author ("You" if self) + one-line truncated body (mention strip → plain `@Name`), accent left-border, `cursor-pointer`.
- [x] 6.3 [frontend] `m.replyTo.deletedAt` set → preview shows "message deleted" (italic), click disabled.
Verify: `/devspec-verify add-chat-reply` — ⚠️ ENV-BLOCKED (same as §5; code done, web build clean).

## 7. Jump to original + scroll anchor [req-7]
- [x] 7.1 [frontend] `MessageRow`: `data-msg-id={m.id}` anchor on the row root (and the deleted placeholder).
- [x] 7.2 [frontend] `MessageThread`: `onQuoteClick(parentId)` finds `[data-msg-id]` in the scroll container → `scrollIntoView({behavior:'smooth', block:'center'})` + `.chat-reply-flash` (~1.4s, `index.css`). Not found → no-op.
- [x] 7.3 [frontend] Quoted-parent block click wired to `onQuoteClick(m.replyTo.id)`.
Verify: `/devspec-verify add-chat-reply` — ⚠️ ENV-BLOCKED (same as §5; code done, web build clean).

## 8. Visual sign-off [req-5, req-6, req-7]
- [ ] 8.1 MANUAL: BA approves screenshot from `/devspec-verify` against `mockups/chat-reply.html` (banner, quoted parent both sides, deleted state, flash).
Verify: MANUAL: BA approves the reply UI screenshot matches the approved mockup.
