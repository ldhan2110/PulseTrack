# Proposal: add-realtime-chat-web (frontend)

## Why
The `add-realtime-chat` backend delivers the chat data, gateway, and API. This change builds the **web UI** users actually chat in — the conversation list, message thread, and composer — wired to the backend's REST endpoints and the `/chat` Socket.IO namespace.

`depends_on: [add-realtime-chat]` — it consumes the backend's built endpoints and socket events.

## What it delivers
- **Chat page** — conversation-list sidebar (DMs + channels, unread counts) + message thread + composer, on a new route.
- **Data layer** — `api.ts` chat methods + `useChat*` react-query hooks (mirrors the `useAiConfig`/`useX` pattern).
- **Realtime** — subscribe to the `/chat` namespace via the socket layer; live message new/updated/deleted, typing, presence, read receipts update the UI without refetch.
- **Nav** — an unread pill on the chat nav icon, **separate** from the notification bell (Route B).
- **Message actions** — edit / delete own message; render soft-deleted as a placeholder.
- **Attachments** — upload from the composer, render/download in the thread (reuse the disk-backed backend endpoint).
- **History** — infinite-scroll older messages (cursor pagination).
- **Emoji** — a text emoji picker inserting unicode into the composer (no backend).

## Scope

**In**
- New chat page + route (`ChatPage.tsx`) and its sub-components.
- `api.ts` chat methods + types in `src/lib/types.ts`; `useChat*` hooks in `src/hooks/`.
- `/chat` socket subscription + live cache updates.
- Conversation list w/ unread counts; chat-icon unread pill (zustand UI state).
- Thread: message list, edit/delete, soft-delete placeholder, attachments render, infinite scroll.
- Composer: text + emoji picker + attachment upload + typing emit.
- Presence dots + read receipts + typing indicator.

**Out (deferred / other change)**
- All backend (owned by `add-realtime-chat`).
- Emoji **reactions** UI — deferred with the backend.
- Chat entries in the notification bell — separate pill by design.
- Message search, threads, pinning.

## Dependencies
- **Hard**: `add-realtime-chat` (backend endpoints + `/chat` events must exist). Set `depends_on: [add-realtime-chat]` at plan.
- **Visual template**: existing planner chat components (`ChatInput`/`ChatMessage`/`ChatMessageList`/`ChatAttachment`) — reuse as styling reference (planner is AI chat; adapt for user-to-user). shadcn primitives, tanstack-query, zustand per conventions.md FE block.
