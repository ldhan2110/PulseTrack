# Design: add-realtime-chat-web (frontend)

## Chosen approach
Build the chat UI as a global page wired to the `add-realtime-chat` backend, following the existing web conventions exactly:
- **Data via `api.ts` + react-query hooks** — add chat methods to the single fetch client (`src/lib/api.ts`) and `useChat*` hooks (`src/hooks/`), mirroring `useNotifications`. No raw fetch in components.
- **Realtime via a `/chat` namespace socket** — the existing `getSocket()` (`src/socket/instance.ts`) connects to the default namespace for notifications. Add a sibling `getChatSocket()` opening the `/chat` namespace with the same Keycloak-token auth. A `useChatSync()` hook subscribes to `chat:message:new/updated/deleted`, `chat:typing`, `chat:presence`, `chat:read` and updates the react-query cache with `setQueryData` (live, no refetch) — same shape as `useNotificationSync`.
- **Access in the existing shell** — extend `AppSidebar` with a `Chat` item (mirror the "My Tasks" item) + unread badge; add the `/chat` route to `App.tsx` under `ProjectLayout`.
- **Reuse planner chat components** as the visual template and shadcn primitives for everything else; the new-conversation overlay is a shadcn `Dialog`.
- **Optimistic send** — append the message locally with a "sending" state, reconcile on the `chat:message:new` echo (dedupe by a client temp id).

## Architecture

```
AppSidebar  ─ Chat item + unread badge (useChatUnread) ─→ route /chat
                                                            │
App.tsx <Route path="/chat"> → ChatPage
   ├─ ConversationList  ──(useConversations)──────────────→ api.getChatConversations()
   │    ├─ Channels group / Direct Messages group
   │    └─ search box → NewConversationDialog (shadcn Dialog)
   │                     └─(useUserChannelSearch)─────────→ api.searchChatTargets(q)
   │                        Message / Open / Join / Create → api.createChatConversation()
   └─ MessageThread (selected conversation)
        ├─ useMessages(convId)  (infinite) ───────────────→ api.getChatMessages(convId, cursor)
        ├─ MessageList (grouped, reuse planner ChatMessage look)
        ├─ Composer (reuse planner ChatInput look)
        │    emoji picker · 🖼️ · 📎 · paste/drag image · send
        │    └─ send ──(useSendMessage, optimistic)───────→ api.sendChatMessage()
        │       upload ──────────────────────────────────→ api.uploadChatAttachment()
        └─ edit/delete/markRead ──────────────────────────→ api.edit/deleteChatMessage(), api.markChatRead()

getChatSocket() ('/chat' ns, Keycloak auth)
   useChatSync(): on chat:message:new/updated/deleted, chat:typing, chat:presence, chat:read
        → qc.setQueryData(['chat', ...])   (live cache update; unread badge recomputed)
```

## Impact Area

### Decision Defaults
| Gray area | Default | Why |
|---|---|---|
| Chat route | `/chat` global (not project-scoped) | chat crosses projects; sibling of `/my-tasks` |
| Sidebar placement | new item after "My Tasks" in `AppSidebar` | most-used global destination grouping |
| Unread badge source | sum of per-conversation unread from `getChatConversations` | backend already returns it (req-8 there) |
| Live update mechanism | socket `setQueryData`, fall back to `invalidateQueries` on reconnect | matches notification pattern, avoids refetch storms |
| Optimistic send | show immediately with temp id + "sending", reconcile on echo | responsive feel; dedupe by temp id |
| Send failure | mark the bubble failed + a retry affordance; keep the draft | no silent message loss |
| Which files render inline | `image/*` MIME only (png/jpg/gif/webp) | user decision — images inline, all else chip |
| Image copy | hover ⧉ Copy → Clipboard API `write` image blob | user asked for copy |
| Paste/drag image | composer listens `paste`/`drop`, uploads image blobs | user asked for paste |
| Emoji | picker inserts unicode into the text input (no reactions) | reactions deferred |
| Message grouping window | consecutive same-author, < 5 min apart, merge | standard chat grouping |
| History page size | 30, infinite scroll upward (cursor from backend) | matches backend req-5 |
| Mark read trigger | on opening a conversation + on new message while focused | keeps unread accurate |
| Empty / loading / error | dedicated states per mockup, not blank | mockup states 3/4/5 |
| Chat-target search source | People: reuse `GET /projects/:projectId/members/search` (project-scoped, current project from route ctx). Channels tab: user's **joined** channels from `getChatConversations` + `Create channel "<query>"`. **Drop** unjoined-channel Join + cross-project people. | human decision 2026-09-21 (worker-cc run): backend `add-realtime-chat` shipped no chat-target/channel-discovery endpoint; reuse the existing member search, no backend change. Narrows req-3 §6 join-unjoined + cross-project scenarios. |

### Blast Radius
- `src/App.tsx` — add `<Route path="/chat">`. **[risk: low]**
- `src/components/layout/AppSidebar.tsx` — add Chat nav item + badge. **[risk: low — existing file, additive]**
- `src/lib/api.ts` — add chat methods (mirror existing). **[risk: low]**
- `src/lib/types.ts` — add chat types matching backend shapes. **[risk: low]**
- `src/socket/instance.ts` — add `getChatSocket()` (`/chat` ns); existing `getSocket()` untouched. **[risk: med — socket lifecycle/reconnect on token refresh must mirror `SocketProvider`]**
- new `src/pages/ChatPage.tsx` + `src/components/chat/*` + `src/hooks/useChat*.ts`. **[risk: low — all new]**
- `NotificationBell` / notification code — untouched (separate unread). **[risk: none]**

### Reversibility
Additive on the web side — one route, one sidebar item, new files. Rollback = remove the route + sidebar item + new files. No existing screen changed.

### Dependency
Hard on `add-realtime-chat` (backend): every hook calls an endpoint / socket event that change must have shipped. `depends_on: [add-realtime-chat]` on the board.

## Rejected approaches
- **Reuse the single default-namespace socket for chat** — rejected. Mixing chat traffic into the notification socket couples them and muddies room/event names; a dedicated `/chat` namespace socket (same auth helper) keeps them independent, matching the backend's separate gateway.
- **Render all attachments inline** — rejected per user decision: only `image/*` inline; other MIME types are download chips (avoids trying to preview arbitrary binaries).
- **Poll for messages** — rejected; socket push + `setQueryData` is the existing realtime pattern (`useNotificationSync`).

## Open questions
- Group DM (3+ people) creation is offered in the overlay; backend treats it as a channel without a name, or a DM with >2 members — confirm the backend `createConversation` contract handles >2-member DM at integration. Non-blocking (default: create as an unnamed channel).
