# Tasks: add-realtime-chat (backend)

## 1. Schema and migration [req-1]
- [x] 1.1 [db] Add to `apps/api/prisma/schema.prisma`: `enum ConversationType { DM CHANNEL }` and models `Conversation`, `ConversationMember`, `Message`, `MessageAttachment` per `db.md` (cuid PK, camelCase, audit quad `createdBy`/`createdAt`/`updatedBy`/`updatedAt` on each, no `projectId`)
- [x] 1.2 [db] Domain FKs: `Conversation.creatorId String?` → User `onDelete:SetNull` relation `"ConversationCreator"`; `ConversationMember.userId` → User `onDelete:Cascade` relation `"ConversationMemberUser"`; `Message.authorId` → User `onDelete:Cascade` relation `"MessageAuthor"`; `MessageAttachment.messageId`/`Message.conversationId`/`ConversationMember.conversationId` → owner `onDelete:Cascade`
- [x] 1.3 [db] Constraints/indexes: `@@unique([conversationId,userId])` + `@@index([userId])` on `ConversationMember`; `@@index([conversationId,createdAt])` on `Message`
- [x] 1.4 [db] Add back-relations on `User`: `createdConversations`, `conversationMemberships`, `authoredMessages`
- [x] 1.5 [db] Generate migration: `pnpm --filter @pm/api exec prisma migrate dev --name add_realtime_chat` (writes `prisma/migrations/*_add_realtime_chat`); `pnpm generate` — migration generated via schema-to-schema `migrate diff` (before/after) to exclude a PRE-EXISTING EntityType.MESSAGE drift that `migrate dev` would have destructively dropped
Verify: `pnpm --filter @pm/api exec prisma migrate reset --force && pnpm --filter @pm/api exec prisma migrate deploy` on scratch DB — 4 tables + enum + unique(conversationId,userId) exist; `pnpm --filter @pm/api test` (existing suites still green)

## 2. Chat module + socket auth [req-12]
- [x] 2.1 [backend] New `ChatModule` (`apps/api/src/chat/chat.module.ts`); register in `apps/api/src/app.module.ts`
- [x] 2.2 [backend] Ensure `SocketAuthService` is injectable in `ChatModule` — verify `NotificationsModule` exports it (`apps/api/src/notifications/notifications.module.ts`); if not, add it to that module's `exports` and import `NotificationsModule` (do NOT duplicate the service)
- [x] 2.3 [backend] New `ChatGateway` (`apps/api/src/chat/chat.gateway.ts`) `@WebSocketGateway({ namespace: '/chat', cors: { origin: '*' } })`; `handleConnection` resolves userId via `SocketAuthService.extractUserFromHandshake`, disconnects if null (mirror `notifications.gateway.ts:29`)
- [x] 2.4 [test] `apps/api/src/chat/chat.gateway.spec.ts`: valid token → connection kept + userId on `socket.data`; missing/invalid token → `disconnect` called
Verify: `pnpm --filter @pm/api test chat.gateway.spec`

## 3. Membership authorization [req-3]
- [x] 3.1 [backend] New `ConversationMemberGuard` (`apps/api/src/chat/conversation-member.guard.ts`) — reads `conversationId` from route params, checks `ConversationMember` for `(conversationId, req.user.id)`, throws `ForbiddenException` if absent. NOT `ProjectRolesGuard` (no projectId)
- [x] 3.2 [service] `ChatService.assertMember(conversationId, userId)` helper reused by the guard and by socket `join` gating
- [x] 3.3 [test] `conversation-member.guard.spec.ts`: member → true; non-member → 403
Verify: `pnpm --filter @pm/api test conversation-member.guard.spec`

## 4. Conversations: create + list [req-2] [req-8]
- [x] 4.1 [service] `ChatService.createConversation(userId, dto)` — CHANNEL: creator `role:"owner"` + members; DM: dedupe by looking up an existing DM whose two memberships match the pair, else create both memberships in a `prisma.$transaction`
- [x] 4.2 [backend] DTOs `create-conversation.dto.ts` (`type: ConversationType`, `name?`, `memberIds: string[]`) — class-validator, keep in sync with `forbidNonWhitelisted`
- [x] 4.3 [service] `ChatService.listMyConversations(userId)` — conversations the user is a member of, each with unread count `count(Message where createdAt > lastReadAt, authorId != userId, deletedAt = null)` and last message
- [x] 4.4 [backend] `ChatController` `POST /chat/conversations` (guard: `JwtAuthGuard`), `GET /chat/conversations` (list mine); actor from `req.user.id`
- [x] 4.5 [test] `chat.service.spec.ts`: channel create sets owner; DM dedupe returns existing; unread excludes own + deleted
Verify: `pnpm --filter @pm/api test chat.service.spec`

## 5. Messages: send + history [req-4] [req-5]
- [x] 5.1 [service] `ChatService.sendMessage(conversationId, authorId, dto)` — reject empty body when no attachment (400); create `Message`; return with author relation
- [x] 5.2 [service] After persist, emit `chat:message:new` to `convo:<conversationId>` via the gateway server
- [x] 5.3 [service] `ChatService.getMessages(conversationId, cursor?)` — 30 newest, `orderBy createdAt desc`, cursor on `createdAt`/`id`; deleted messages returned with body omitted; returns `{ items, nextCursor }`
- [x] 5.4 [backend] `ChatController` `POST /chat/conversations/:id/messages` + `GET /chat/conversations/:id/messages?cursor=` (guards: `JwtAuthGuard`, `ConversationMemberGuard`)
- [x] 5.5 [backend] Socket `@SubscribeMessage('chat:send')` path in `ChatGateway` gating room membership via `ChatService.assertMember` before persist+emit (added a member-gated `chat:join` handler so rooms are joinable for receive/typing — not separately spec'd but required for room delivery)
- [x] 5.6 [test] `chat.service.spec.ts`: send persists + empty→400; history first page 30 + nextCursor; second page older
Verify: `pnpm --filter @pm/api test chat.service.spec`

## 6. Messages: edit + soft-delete [req-6] [req-7]
- [x] 6.1 [service] `ChatService.editMessage(messageId, userId, body)` — author-only (403 else), set body + `editedAt`, `updatedBy`; emit `chat:message:updated`
- [x] 6.2 [service] `ChatService.deleteMessage(messageId, userId)` — author OR channel `owner` (403 else), set `deletedAt`, keep row; emit `chat:message:deleted`
- [x] 6.3 [backend] `ChatController` `PATCH /chat/messages/:id`, `DELETE /chat/messages/:id` (guards: `JwtAuthGuard`; ownership checked in service)
- [x] 6.4 [test] `chat.service.spec.ts`: author edit ok / non-author 403; author + owner delete ok / other member 403; deleted body omitted in reads
Verify: `pnpm --filter @pm/api test chat.service.spec`

## 7. Read state [req-8]
- [x] 7.1 [service] `ChatService.markRead(conversationId, userId)` — set `ConversationMember.lastReadAt = now()`; emit `chat:read` to room
- [x] 7.2 [backend] `ChatController` `POST /chat/conversations/:id/read` (guards: `JwtAuthGuard`, `ConversationMemberGuard`)
- [x] 7.3 [test] `chat.service.spec.ts`: markRead bumps lastReadAt; subsequent unread count drops to 0
Verify: `pnpm --filter @pm/api test chat.service.spec`

## 8. Typing + presence [req-9] [req-10]
- [x] 8.1 [backend] `ChatGateway` `@SubscribeMessage('chat:typing')` — relay `chat:typing` to `convo:<id>` (socket.to → others only), no DB write
- [x] 8.2 [backend] Presence in `ChatGateway`: `Map<userId, Set<socketId>>`; add on connect, remove socket on disconnect, online = set non-empty; emit `chat:presence` on transitions
- [x] 8.3 [test] `chat.gateway.spec.ts`: typing relays without a Prisma call; two sockets for one user → still online after one disconnects, offline after both
Verify: `pnpm --filter @pm/api test chat.gateway.spec`

## 9. Attachments [req-11]
- [x] 9.1 [backend] `ChatController` `POST /chat/conversations/:id/attachments` — `FileInterceptor` + multer `diskStorage` to `uploads/chat/<conversationId>/`, `randomUUID()+ext`, 100MB limit (clone `attachments.controller.ts:28-45`); guards `JwtAuthGuard` + `ConversationMemberGuard`
- [x] 9.2 [service] Create the `Message` (may have empty body) + `MessageAttachment` rows in one `prisma.$transaction`; emit `chat:message:new`
- [x] 9.3 [backend] `GET /chat/attachments/:id/download` — look up attachment → conversation, assert requester membership (403 else), `res.download(uploads/chat/<conversationId>/<storedName>, filename)` (clone `attachments.controller.ts:56-66`)
- [x] 9.4 [test] `chat.service.spec.ts`/controller test: upload creates row with storedName+mimeType+size; non-member download → 403
Verify: `pnpm --filter @pm/api test chat`
