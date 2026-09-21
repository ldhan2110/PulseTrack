# DB: add-realtime-chat

**Source**: file-derived — `apps/api/prisma/schema.prisma` (may lag prod; migrations/ is the live baseline)
**Dialect**: postgresql, `@prisma/adapter-pg` (per conventions.md backend block + schema.md)
**Migration**: additive only — 4 new models + 1 new enum, plus back-relation fields on `User`. No column change to an existing table, no backfill, no destructive op.

> Chat tables follow schema.md conventions: `id String @id @default(cuid())`, camelCase, explicit `onDelete`, `@relation` names for multi-FK-to-User.
> **Audit quad (per improve/conventions.md — standing rule)**: every table carries
> `createdBy String?` · `createdAt DateTime @default(now())` · `updatedBy String?` · `updatedAt DateTime @updatedAt`.
> `createdBy`/`updatedBy` = **plain user-id strings, no `Id` suffix, no FK relation** (pure audit — survives user deletion, no cascade). Distinct from **domain display FKs** (`Conversation.creatorId`, `Message.authorId`, `ConversationMember.userId`) which ARE relations because the UI navigates them for name/avatar.
> **Chat is NOT project-scoped** — no `projectId` anywhere. Authz = conversation membership, not `ProjectRolesGuard`.

## Enum (new)

### ConversationType
```
enum ConversationType { DM  CHANNEL }
```
> Types the **conversation**, not the message. PascalCase name + SCREAMING members (matches `NotificationType`/`BugSeverity`).

## Tables touched

### Conversation  (new)
| col | type | null | default | note |
|-----|------|------|---------|------|
| id | String | no | cuid() | PK |
| type | ConversationType | no | — | DM or CHANNEL |
| name | String? | **yes** | — | channel name; null for DM |
| creatorId | String? | **yes** | — | **domain FK** → User.id, `onDelete: SetNull`, relation `"ConversationCreator"`; nullable so channel survives creator deletion (open-q1 resolved) |
| createdBy | String? | **yes** | — | audit — user id, no relation |
| createdAt | DateTime | no | now() | audit |
| updatedBy | String? | **yes** | — | audit — user id, no relation |
| updatedAt | DateTime | no | @updatedAt | audit |

### ConversationMember  (new) — membership = authz + unread + read-receipt
| col | type | null | default | note |
|-----|------|------|---------|------|
| id | String | no | cuid() | PK |
| conversationId | String | no | — | FK → Conversation.id, `onDelete: Cascade` |
| userId | String | no | — | **domain FK** → User.id, `onDelete: Cascade`, relation `"ConversationMemberUser"` (the member — UI shows their avatar) |
| role | String? | **yes** | — | `"owner"`/`"member"` for channels; null for DM. String not enum (low churn) |
| lastReadAt | DateTime? | **yes** | — | read-receipt + unread cursor; null = never opened |
| mutedAt | DateTime? | **yes** | — | per-convo mute; null = unmuted |
| createdBy | String? | **yes** | — | audit — who added this member (channel invite may differ from member) |
| createdAt | DateTime | no | now() | audit (= joinedAt) |
| updatedBy | String? | **yes** | — | audit |
| updatedAt | DateTime | no | @updatedAt | audit |
| | | | | `@@unique([conversationId, userId])` — one membership per user per convo |
| | | | | `@@index([userId])` — "my conversations" list |

### Message  (new)
| col | type | null | default | note |
|-----|------|------|---------|------|
| id | String | no | cuid() | PK |
| conversationId | String | no | — | FK → Conversation.id, `onDelete: Cascade` |
| authorId | String | no | — | **domain FK** → User.id, `onDelete: Cascade`, relation `"MessageAuthor"` (sender — UI shows name/avatar) |
| body | String | no | — | text (emoji = unicode in body, no table) |
| editedAt | DateTime? | **yes** | — | null = never edited |
| deletedAt | DateTime? | **yes** | — | **soft-delete** (open-q2 — intentional exception to schema.md hard-delete) |
| createdBy | String? | **yes** | — | audit (= authorId, kept uniform per convention) |
| createdAt | DateTime | no | now() | audit |
| updatedBy | String? | **yes** | — | audit — who last edited |
| updatedAt | DateTime | no | @updatedAt | audit |
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
| createdBy | String? | **yes** | — | audit — uploader (= message author) |
| createdAt | DateTime | no | now() | audit |
| updatedBy | String? | **yes** | — | audit |
| updatedAt | DateTime | no | @updatedAt | audit |
> Files land at `uploads/chat/<conversationId>/<storedName>` mirroring `uploads/tasks/<taskId>/` (attachments.controller.ts:33).

### User  (exists — back-relations only, additive)
| field | type | note |
|-------|------|------|
| createdConversations | Conversation[] | **add** relation `"ConversationCreator"` (← Conversation.creatorId) |
| conversationMemberships | ConversationMember[] | **add** relation `"ConversationMemberUser"` (← ConversationMember.userId) |
| authoredMessages | Message[] | **add** relation `"MessageAuthor"` (← Message.authorId) |
> Relation-only fields — no DB column on `User`; Prisma virtual side of the domain FKs. Audit `createdBy`/`updatedBy` are plain strings → **no** back-relation needed (that's the point of keeping them relation-free). Same virtual-side pattern as existing `uploadedAttachments`/`notifications` (User model:214–246).

## Impact / blast radius
- **Zero existing readers/writers** — all 4 tables new, no code queries them yet. Additive migration; no regression on task/bug/notification paths.
- `NotificationsGateway`/`NotificationsService` **untouched** — chat gets its own `ChatGateway` + rooms `convo:<id>`. Route B keeps chat out of the `Notification` table (its `projectId` NOT NULL + `entityType` TASK|BUG — chat can't fit without a risky migration; design.md rejected-approach).
- Attachment disk pattern reused (`attachments.controller.ts` diskStorage + `attachments.service.ts`) — new `uploads/chat/` dir, same `mkdirSync`/`randomUUID`/`res.download`. No change to existing attachment code.

## Open questions — resolved
1. **`Conversation.creatorId` on-delete** → nullable + `SetNull` (channel survives creator's User-row deletion). ✅ confirmed.
2. **`Message.deletedAt` soft-delete** → intentional, scoped exception to schema.md hard-delete norm (chat needs "message deleted" placeholder + audit). ✅ confirmed, flagged as deliberate.

## Verify hooks (for tasks.md, not run here)
- schema assertion: after `pnpm migrate`, the 4 tables + `ConversationType` enum exist with the columns/nullability above; audit quad on every table; `@@unique([conversationId,userId])` present.
- migration clean: new Prisma migration applies on a scratch DB via `pnpm migrate`.
- no-regression: `pnpm --filter @pm/api test` — existing task/bug/notification suites still pass.
