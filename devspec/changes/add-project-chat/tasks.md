# Tasks: add-project-chat

## 1. Schema + migration [req-1]
- [x] 1.1 [db] Delete the untracked dead dir `apps/api/prisma/migrations/20260911000001_add_chat_tables/` (never committed; wrong enum names, out-of-scope cols — see `db.md`)
- [x] 1.2 [db] Add to `apps/api/prisma/schema.prisma`: enum `ConversationType { PROJECT DIRECT }`; models `Conversation` (id cuid, projectId, type, createdAt, updatedAt @updatedAt), `ConversationMember` (id, conversationId, userId, lastReadAt?, createdAt, updatedAt @updatedAt, `@@unique([conversationId,userId])`, `@@index([userId])`), `Message` (id, conversationId, senderId, body, createdAt, `@@index([conversationId,createdAt])`). FKs onDelete Cascade to Project/User/Conversation. Add back-relations on `User` + `Project`.
- [x] 1.3 [db] Partial unique index — one PROJECT per project — via migration raw SQL `CREATE UNIQUE INDEX "Conversation_projectId_project_key" ON "Conversation"("projectId") WHERE "type" = 'PROJECT';` (Prisma `@@unique` can't express the WHERE)
- [ ] 1.4 [db] Generate migration: `pnpm --filter @pm/api exec prisma migrate dev --name add_project_chat` then `pnpm generate`
Verify: `pnpm --filter @pm/api exec prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-migrations prisma/migrations --exit-code` (schema ⇄ migrations agree); assert enum + 3 tables + partial index exist.

## 2. Authz resource [req-2][req-3][req-4][req-5]
- [ ] 2.1 [backend] Add `chat: PermissionSet` to `RolePermissions` and `SYSTEM_ROLE_PERMISSIONS` (`apps/api/src/auth/permissions.ts`) — `ALL_TRUE` for system roles; any project member gets view+create by default (baseline collaboration, like `comments`)
Verify: `pnpm --filter @pm/api test` (permissions map compiles + member default resolves view/create true)

## 3. Chat service + REST [req-2][req-3][req-4][req-5][req-6]
- [ ] 3.1 [service] New `apps/api/src/chat/chat.service.ts` (`ChatService`, inject `PrismaService`): `listConversations(projectId, userId)` — lazy-create PROJECT channel in a `$transaction` if absent, return channel + user's DMs each with `unreadCount` (count Message where createdAt > member.lastReadAt)
- [ ] 3.2 [service] `openDirect(projectId, userId, otherUserId)` — assert both are project members (`ProjectMember`), sorted-pair lookup for existing DIRECT (exactly-two-member match), reuse or create with 2 `ConversationMember` rows
- [ ] 3.3 [service] `getMessages(conversationId, userId, cursor?)` — assert membership, return ≤30 `createdAt desc` + next cursor
- [ ] 3.4 [service] `sendMessage(conversationId, userId, body)` — assert membership, `$transaction`: insert Message + bump conversation `updatedAt`; return message + audience (projectId for PROJECT, member userIds for DIRECT)
- [ ] 3.5 [service] `markRead(conversationId, userId)` — set member `lastReadAt = now()`
- [ ] 3.6 [backend] New `apps/api/src/chat/dto/`: `SendMessageDto` (`body` `@IsString @IsNotEmpty @MaxLength(4000)`, trimmed), `OpenDirectDto` (`userId @IsString`)
- [ ] 3.7 [backend] New `apps/api/src/chat/chat.controller.ts` — `@Controller('projects/:projectId/chat')`, class `@UseGuards(JwtAuthGuard, ProjectRolesGuard)`. Routes: `GET conversations` `@RequirePermission('chat','view')`; `POST conversations/direct` (`view`); `GET conversations/:id/messages` (`view`); `POST conversations/:id/messages` (`create`); `POST conversations/:id/read` (`view`). Actor from `req.user.id`
- [ ] 3.8 [backend] New `apps/api/src/chat/chat.module.ts`; register in `apps/api/src/app.module.ts` imports
- [ ] 3.9 [test] `apps/api/src/chat/chat.service.spec.ts` (vitest): lazy channel idempotent, DM reuse (both orders), unread count, non-member send/read → throws, empty body rejected
Verify: `pnpm --filter @pm/api test chat`

## 4. Live delivery [req-5][req-7]
- [ ] 4.1 [backend] Export/share `SocketAuthService` from notifications module (`apps/api/src/notifications/`) so chat can inject it (already `@Injectable`)
- [ ] 4.2 [backend] New `apps/api/src/chat/chat.gateway.ts` (`@WebSocketGateway({ cors:{origin:'*'} })`) — on connect auth via `SocketAuthService`, join `user:${userId}`; `@SubscribeMessage('chat:join-project')` joins `project:${id}`. Expose `emitMessage(audience, message)` the service calls after send: emit `chat:new` to `project:${projectId}` (PROJECT) or each `user:${userId}` (DIRECT)
- [ ] 4.3 [service] Wire `ChatService.sendMessage` → gateway `emitMessage` (inject gateway or via `setServer` pattern like `NotificationsGateway.afterInit`)
Verify: `pnpm --filter @pm/api test chat` (gateway emit called with correct rooms — mock server)

## 5. Web API client + hooks [req-4][req-5][req-6][req-7]
- [ ] 5.1 [frontend] Add `Conversation`, `ConversationMember`, `Message`, `ConversationType` types to `apps/web/src/lib/types.ts`
- [ ] 5.2 [frontend] Add `chat` block to the `api` object in `apps/web/src/lib/api.ts` via `request<T>`: `listConversations`, `openDirect`, `getMessages`, `sendMessage`, `markRead` (paths under `/projects/:projectId/chat`)
- [ ] 5.3 [frontend] New `apps/web/src/hooks/useChat.ts` — react-query: `useConversations(projectId)`, `useMessages(conversationId)` (infinite, cursor), `useSendMessage` (invalidate/append), `useMarkRead`. `onError` → `toast.error` per convention
- [ ] 5.4 [frontend] socket.io-client: subscribe `chat:new` in `useChat`, push into the messages cache + bump unread; emit `chat:join-project` on mount
Verify: `pnpm --filter @pm/web test` (hooks compile; cache update on chat:new)

## 6. Chat drawer UI [req-7]
- [ ] 6.1 [frontend] New `apps/web/src/components/chat/ChatDrawer.tsx` — reuse `<Sheet><SheetContent side="right">` (`src/components/ui/sheet.tsx`); NOT a new drawer
- [ ] 6.2 [frontend] `ConversationList.tsx` — rail with Channel + Direct sections; reuse `<Avatar>` (`ui/avatar.tsx`), `<Badge>` (`ui/badge.tsx`) for unread, `<ScrollArea>` (`ui/scroll-area.tsx`)
- [ ] 6.3 [frontend] `MessageThread.tsx` — reuse `<ScrollArea>`; own vs other bubble alignment; "Load earlier" pager via `useMessages` cursor; mark-read on view
- [ ] 6.4 [frontend] `Composer.tsx` — reuse `<Textarea>` (`ui/textarea.tsx`) + `<Button>` (`ui/button.tsx`); Enter sends, Shift+Enter newline, Send disabled when empty
- [ ] 6.5 [frontend] `NewDmPicker.tsx` — reuse `<Input>` (`ui/input.tsx`) or `<Command>` (`ui/command.tsx`); list project members, select → `openDirect`
- [ ] 6.6 [frontend] Mount drawer + trigger button in the project layout/header (project routes in `apps/web/src/App.tsx`)
Verify: `/devspec-verify add-project-chat` (agent-browser: drawer opens, rail + thread + composer regions present, non-plain shadcn styling, unread badge renders, scroll-back pages past first load, live message appears)
