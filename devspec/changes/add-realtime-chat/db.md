# DB: add-realtime-chat

**Source**: file-derived — `apps/api/prisma/schema.prisma` (may lag prod; migrations/ is the live baseline)
**Dialect**: postgresql, `@prisma/adapter-pg` (per conventions.md backend block + schema.md)
**Migration**: additive only — 4 new models + 1 new enum, plus back-relation fields on `User`. No column change to an existing table, no backfill, no destructive op.

> All chat tables follow schema.md conventions: `id String @id @default(cuid())`, camelCase fields, explicit `onDelete`, `@relation` names for multi-FK-to-User, `createdAt @default(now())`.
> **Chat is NOT project-scoped** — no `projectId` on any model (cross-project / cross-department DMs + standalone channels). Authz is conversation membership, not `ProjectRolesGuard`.

## Enum (new)

### ConversationType
```
enum ConversationType { DM  CHANNEL }
```
> Renamed from the args' "ChatMessageType" — it types the **conversation**, not the message. PascalCase name + SCREAMING members, matches `NotificationType`/`BugSeverity` style.

## Tables touched

### Conversation  (new)
| col | type | null | default | note |
|-----|------|------|---------|------|
| id | String | no | cuid() | PK |
| type | ConversationType | no | — | DM or CHANNEL |
| name | String? | **yes** | — | channel name; null for DM |
| createdById | String | no | — | FK → User.id, `onDelete: SetNull`? see open-q; relation `"ConversationCreator"` |
| createdAt | DateTime | no | now() | |

### ConversationMember  (new) — membership = authz + unread + read-receipt
| col | type | null | default | note |
|-----|------|------|---------|------|
| id | String | no | cuid() | PK |
| conversationId | String | no | — | FK → Conversation.id, `onDelete: Cascade` |
| userId | String | no | — | FK → User.id, `onDelete: Cascade` |
| role | String? | **yes** | — | `"owner"`/`"member"` for channels; null for DM. String not enum — low churn, ponytail |
| lastReadAt | DateTime? | **yes** | — | read-receipt + unread cursor; null = never opened |
| mutedAt | DateTime? | **yes** | — | per-convo mute; null = unmuted |
| joinedAt | DateTime | no | now() | |
| | | | | `@@unique([conversationId, userId])` — one membership per user per convo |
| | | | | `@@index([userId])` — "my conversations" list |

### Message  (new)
| col | type | null | default | note |
|-----|------|------|---------|------|
| id | String | no | cuid() | PK |
| conversationId | String | no | — | FK → Conversation.id, `onDelete: Cascade` |
| senderId | String | no | — | FK → User.id, `onDelete: Cascade`; relation `"MessageSender"` |
| body | String | no | — | text (emoji = unicode in body, no table) |
| editedAt | DateTime? | **yes** | — | null = never edited |
| deletedAt | DateTime? | **yes** | — | **soft-delete** (chat convention; differs from schema.md "hard-delete" default — flagged below) |
| createdAt | DateTime | no | now() | |
| | | | | `@@index([conversationId, createdAt])` — history cursor pagination |

### MessageAttachment  (new) — clones `Attachment` disk-storage shape
| col | type | null | default | note |
|-----|------|------|---------|------|
| id | String | no | cuid() | PK |
| messageId | String | no | — | FK → Message.id, `onDelete: Cascade` |
| filename | String | no | — | original name (matches `Attachment.filename`) |
| storedName | String | no | — | uuid.ext on disk (matches `Attachment.storedName`) |
| mimeType | String | no | — | |
| size | Int | no | — | bytes |
| createdAt | DateTime | no | now() | |
> No `uploaderId` — uploader is `message.senderId` (derivable), so omitted. Files land at `uploads/chat/<conversationId>/<storedName>` mirroring `uploads/tasks/<taskId>/` (attachments.controller.ts:33).

### User  (exists — back-relations only, additive)
| col | type | null | default | note |
|-----|------|------|---------|------|
| createdConversations | Conversation[] | — | — | **add** relation `"ConversationCreator"` |
| conversationMemberships | ConversationMember[] | — | — | **add** |
| sentMessages | Message[] | — | — | **add** relation `"MessageSender"` |
> Relation-only fields — no DB column on `User`; Prisma virtual side of the FK. Same pattern as existing `uploadedAttachments`/`notifications` back-relations (User model:214–246).

## Impact / blast radius
- **Zero existing readers/writers** — all 4 tables new, no code queries them yet. Additive migration; no regression surface on task/bug/notification paths.
- `NotificationsGateway`/`NotificationsService` **untouched** — chat gets its own `ChatGateway` + rooms `convo:<id>`; Route B keeps chat notifications out of the `Notification` table (its `projectId` is NOT NULL + `entityType` TASK|BUG — chat can't fit it without a risky migration; see design.md rejected-approach).
- Attachment disk pattern reused (`attachments.controller.ts` diskStorage + `attachments.service.ts` create/delete) — new `uploads/chat/` dir, same `mkdirSync`/`randomUUID`/`res.download` shape. No change to existing attachment code.

## Open questions (for human / design.md)
1. **`Conversation.createdById` on-delete**: `SetNull` (keep convo if creator's User row deleted) needs the FK nullable (`createdById String?`). `Cascade` (delete convo with creator) keeps it non-null but nukes group history when an owner is removed. Schema.md default for optional refs = `SetNull`. **Lean: nullable + SetNull** so a channel survives its creator leaving. Confirm at capture.
2. **Message soft-delete** (`deletedAt`) diverges from schema.md's hard-delete convention (no soft-delete column elsewhere). Justified — chat needs "message deleted" placeholder + audit. Flagged as an intentional, scoped exception, not drift.

## Verify hooks (for tasks.md, not run here)
- schema assertion: after `pnpm migrate`, the 4 tables + `ConversationType` enum exist with the columns/nullability above; `@@unique([conversationId,userId])` present.
- migration clean: new Prisma migration applies on a scratch DB via `pnpm migrate`.
- no-regression: `pnpm --filter @pm/api test` — existing task/bug/notification suites still pass (additive change, should be untouched).
