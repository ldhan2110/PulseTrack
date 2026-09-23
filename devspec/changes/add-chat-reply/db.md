# DB: add-chat-reply

**Source**: file-derived (Prisma `schema.prisma` + migrations dir) — no live DB MCP reachable; may drift from prod.
**Dialect**: postgresql (per `conventions.md` backend block, `schema.prisma:10`)
**Migration tool/layout**: Prisma migrations, one timestamped folder per change under `apps/api/prisma/migrations/YYYYMMDDHHMMSS_<name>/migration.sql`. Latest: `20260923000000_add_project_soft_delete`.

## Tables touched

### Message  (exists — `schema.prisma:1263`)
| col | type | null | default | note |
|-----|------|------|---------|------|
| id | text (cuid) | no | cuid() | PK |
| conversationId | text | no | — | FK → Conversation.id, cascade |
| authorId | text | no | — | FK → User.id, cascade |
| body | text | no | — | mention tokens `@[Name](userId)` embedded |
| editedAt | timestamptz | yes | — | null = never edited |
| deletedAt | timestamptz | yes | — | soft-delete; list maps deleted → `body:''` (`chat.service.ts:330`) |
| createdAt | timestamptz | no | now() | — |
| **replyToId** | text | **add** | — | **new, nullable** — self-FK → Message.id. Null = not a reply. No backfill (existing rows = null). |

New relations on Message (self-relation, name it e.g. `"MessageReplyTo"`):
- `replyTo   Message?  @relation("MessageReplyTo", fields: [replyToId], references: [id], onDelete: SetNull)`
- `replies   Message[] @relation("MessageReplyTo")`

**FK on-delete = `SetNull`** (not cascade): parent hard-deleted → child's `replyToId` clears, child survives. Matches "message deleted" UX — but note chat uses **soft-delete** (`deletedAt`), so hard delete is rare; SetNull is the safety net. Parent soft-deleted → `replyToId` stays, preview reads `deletedAt` and renders "message deleted".

Optional index: `@@index([replyToId])` — only needed if we ever query "replies to X" (thread view). v1 doesn't; **skip the index** (YAGNI), add when thread-view ships.

## Impact
- **Read sites — 3 include blocks must add `replyTo`** so the preview rides every message payload:
  - `sendMessage` create (`chat.service.ts:277`) — broadcast to `convo:` room
  - `getMessages` findMany (`chat.service.ts:322`) — history page load
  - `editMessage` update (`chat.service.ts:351`) — edit broadcast
  - `replyTo` include shape: `replyTo: { select: { id, body, deletedAt, author: memberUserSelect } }` (shallow — no nested replyTo, no reactions/attachments on the preview).
- **Deleted-parent handling** — `getMessages` already rewrites `deletedAt` rows to `body:''` (`chat.service.ts:330`); the nested `replyTo` preview needs the same guard so a reply to a deleted msg shows "message deleted", not stale body. Apply at the preview mapper or in the render layer (`MessageRow`).
- **Same-conversation guard** — `sendMessage` must validate `replyToId`'s message has the same `conversationId` (reject cross-channel reply). Cheap `findUnique({where:{id:replyToId}, select:{conversationId}})` before create.
- No other feature writes `Message` — chat-only table (`add-realtime-chat`). Additive column, zero readers break.
- `chat-members-mentions` (board: blocked, code done) touches `Message.body` render only — no schema overlap. `depends_on: []`.

## Migration verdict
**Additive, safe.** One nullable self-FK column + self-relation. No backfill (existing rows null). No data reshape. No destructive op. Prisma migration `add_chat_reply` generates `ALTER TABLE "Message" ADD COLUMN "replyToId" TEXT;` + FK constraint.

## Verify hooks (for capture's tasks.md)
- schema assertion: `Message.replyToId` exists, type text, nullable; FK → Message.id on-delete SetNull.
- migration runs clean on scratch DB, `prisma migrate` applies without error.
- no-regression: existing `getMessages`/`sendMessage` chat.service tests still green after include change.

## Open questions
- Index `@@index([replyToId])`? → **default no** (no reply-thread query in v1 scope). Revisit if thread view added.
