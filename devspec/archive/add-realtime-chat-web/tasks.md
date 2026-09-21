# Tasks: add-realtime-chat-web (frontend)

> depends_on: [add-realtime-chat]. Every hook targets a backend endpoint / `/chat` socket event that change ships. Reuse planner chat components (`src/components/planner/`) as the visual template + shadcn primitives.

## 1. Data layer — api + types + hooks [req-1] [req-2] [req-5] [req-6] [req-7] [req-11]
- [x] 1.1 [frontend] Add chat types to `src/lib/types.ts` mirroring backend shapes: `Conversation`, `ConversationMember`, `Message`, `MessageAttachment`, `ConversationType`
- [x] 1.2 [frontend] Add methods to `src/lib/api.ts` (via `request`/multipart, mirror existing): `getChatConversations()`, `createChatConversation(dto)`, `searchChatTargets(q)`, `getChatMessages(convId, cursor?)`, `sendChatMessage(convId, dto)`, `editChatMessage(id, body)`, `deleteChatMessage(id)`, `markChatRead(convId)`, `uploadChatAttachment(convId, file)`, `downloadChatAttachment(id)`
- [x] 1.3 [frontend] `src/hooks/useChat.ts` — `useConversations`, `useChatUnread` (derives total), `useMessages` (`useInfiniteQuery`, cursor), `useSendMessage` (optimistic temp-id), `useEditMessage`, `useDeleteMessage`, `useMarkChatRead`, `useSearchChatTargets`; `onError` → `toast.error`
- [x] 1.4 [test] `src/hooks/useChat.test.ts`: optimistic send inserts temp then reconciles on echo; unread derivation sums per-conversation counts
Verify: `pnpm --filter @pm/web test useChat`

## 2. Chat socket namespace + live sync [req-5] [req-9] [req-10] [req-12]
- [x] 2.1 [frontend] `getChatSocket()` in `src/socket/instance.ts` — `io(base + '/chat', { auth:{token}, autoConnect:false })`, mirror `getSocket()`; do NOT touch existing `getSocket()`
- [x] 2.2 [frontend] Reconnect on token refresh — mirror `SocketProvider.tsx` effect (disconnect().connect() on new `auth.token`) for the chat socket
- [x] 2.3 [frontend] `src/hooks/useChatSync.ts` — subscribe `chat:message:new|updated|deleted`, `chat:typing`, `chat:presence`, `chat:read`; update react-query cache via `qc.setQueryData`; `invalidateQueries(['chat'])` on reconnect
- [x] 2.4 [test] `useChatSync.test.ts`: a `chat:message:new` event appends to the cached thread; `chat:presence` updates presence cache
Verify: `pnpm --filter @pm/web test useChatSync`

## 3. Access — sidebar item + route [req-1]
- [x] 3.1 [frontend] Add `Chat` item to `src/components/layout/AppSidebar.tsx` (mirror the "My Tasks" item ~line 170; `MessageSquare` icon) with an unread `<Badge>` from `useChatUnread`; navigate `/chat`
- [x] 3.2 [frontend] Add `<Route path="/chat" element={<ChatPage />} />` under `ProjectLayout` in `src/App.tsx`
- [x] 3.3 [frontend] Mount `useChatSync()` at the chat page (or layout) so events flow while chat is active
Verify: `/devspec-verify add-realtime-chat-web` (agent-browser: Chat item visible in sidebar, badge renders, click → `/chat` page loads)

## 4. Conversation list [req-2] [req-11]
- [x] 4.1 [frontend] `src/components/chat/ConversationList.tsx` — split **Channels** (`Hash` icon, unread `<Badge>`) and **Direct Messages** (`<Avatar>` + presence dot) groups, each with a `+`; header "Chat" + `<Button>` New; search box opens the overlay (§6)
- [x] 4.2 [frontend] Selecting a conversation sets active + calls `useMarkChatRead` (clears its unread)
- [x] 4.3 [frontend] Empty / loading (skeletons) / error states per mockup states 3–5
- [x] 4.4 [frontend] UI state (active conversation id, overlay open) in `src/store/uiStore.ts` (zustand), per conventions
Verify: `/devspec-verify add-realtime-chat-web` (agent-browser: Channels + Direct Messages groups render, unread badges, empty state)

## 5. Message thread + composer [req-4] [req-5] [req-6] [req-7] [req-9]
- [x] 5.1 [frontend] `src/components/chat/MessageThread.tsx` — header (peer/# + presence), scroll body, reuse planner `ChatMessageList`/`ChatMessage` look for grouped runs (avatar+name once, stacked bubbles, own right / other left)
- [x] 5.2 [frontend] Render `editedAt` marker + soft-deleted placeholder; hover own message → edit / delete (`useEditMessage`/`useDeleteMessage`)
- [x] 5.3 [frontend] Infinite scroll upward via `useMessages` cursor — prepend older, preserve scroll position
- [x] 5.4 [frontend] `src/components/chat/Composer.tsx` — single rounded pill (reuse planner `ChatInput` look), ghost icons: emoji picker (`Smile`, inserts unicode), image (`Image`), attach (`Paperclip`), send (`Send`); Enter sends; emit `chat:typing` (debounced) on input
- [x] 5.5 [frontend] Typing indicator in thread from `chat:typing`; read receipts (✓✓) on own messages from `chat:read`
- [x] 5.6 [test] `MessageThread.test.tsx`: consecutive same-author messages render one avatar/name; deleted → placeholder, no body
Verify: `/devspec-verify add-realtime-chat-web` (agent-browser: grouped bubbles, composer pill with ghost icons, typing indicator; styling not plain)

## 6. New-conversation overlay [req-3]
- [x] 6.1 [frontend] `src/components/chat/NewConversationDialog.tsx` — shadcn `<Dialog>`, input + `Esc`, All/People/Channels tabs, `useSearchChatTargets`
- [x] 6.2 [frontend] People → `Message` (createChatConversation DM, reuse if exists); Channels → `Open` (joined) / `Join`; bottom `Create channel "<query>"`
- [x] 6.3 [frontend] No-match state per mockup 6b
- [x] 6.4 [test] `NewConversationDialog.test.tsx`: typing filters results; Message on a never-messaged person calls createChatConversation
Verify: `/devspec-verify add-realtime-chat-web` (agent-browser: overlay opens over dimmed app, tabs, People/Channels results, create affordance)

## 7. Attachments — inline images + copy + paste/drag [req-8]
- [x] 7.1 [frontend] `src/components/chat/MessageAttachment.tsx` — `image/*` → inline `<img>` thumbnail (click to zoom) + hover **Copy** (Clipboard API `write` image blob); all other MIME → download chip (reuse planner `ChatAttachment` chip look), click → `downloadChatAttachment`
- [x] 7.2 [frontend] Composer `paste` + `drop` handlers — image blobs become pending attachments; `uploadChatAttachment` on send; drag-over affordance
- [x] 7.3 [test] `MessageAttachment.test.tsx`: `image/png` renders `<img>` + copy button; `application/pdf` renders chip only (not `<img>`)
Verify: `/devspec-verify add-realtime-chat-web` (agent-browser: inline image thumbnail with copy, pdf as chip, paste hint present)

## 8. End-to-end visual gate [req-1..req-12]
- [x] 8.1 [frontend] Wire `src/pages/ChatPage.tsx` = ConversationList + MessageThread + overlay; route active
- [x] 8.2 MANUAL: BA approves screenshot of `/chat` against `mockups/chat-page.html` (states: filled, empty, overlay, inline image) — BA-approved 2026-09-21 (user "approved, auto go"); evidence in verify/chat-{empty,overlay,filled}.png
Verify: MANUAL: BA approves `/devspec-verify` screenshot of the chat page matches the approved mockup
