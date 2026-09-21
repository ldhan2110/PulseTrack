# UI: add-realtime-chat-web

**Mockup**: `mockups/chat-page.html` (approved 2026-09-21) — one file, all states stacked.
**References**: composer matched to user screenshot (single rounded pill + ghost icons, `Screenshot 2026-09-21 09.18.27`); message bubbles mirror planner `src/components/planner/ChatMessage.tsx`.
**Style source**: tokens from `apps/web/src/index.css` `:root` (shadcn oklch neutral — `--primary`, `--muted`, `--accent`, `--border`, `--radius`); Tailwind 4 + shadcn primitives per conventions.md FE block. Geist font.

## Access point (state 0)
Chat is **not standalone** — it integrates into the existing shell:
- New top-level item **`💬 Chat`** in `src/components/layout/AppSidebar.tsx`, beside "My Tasks", with an **unread badge** (total across conversations).
- Global route **`/chat`** (cross-project, sibling of `/my-tasks` and `/notifications`) rendered in the `ProjectLayout` `<Outlet>`.
- Unread badge is **separate** from the `NotificationBell` (`ProjectLayout.tsx:56`) — bell unchanged.

## chat page (`/chat`)
Two columns inside the main area (the existing AppSidebar sits left of both):
```
┌────────────── conversation list ──────────────┬──────────── thread ────────────┐
│ header: "Chat"          [ + New ]              │ header: peer/#channel + presence │
│ [ Search people & channels ]  → opens overlay  │ ┌ ↑ Load older (infinite scroll)│
│ CHANNELS                                   +   │ │ day separator                  │
│   # logistics-ops                    (3)       │ │ ▣ grouped run (avatar+name once│
│   # qa-releases                      (4)       │ │   then stacked bubbles)        │
│ DIRECT MESSAGES                            +   │ │   inline image + ⧉Copy         │
│   ● Mai Khanh            (selected)            │ │   file → download chip         │
│   ○ Duc Phan                                   │ │   read ✓✓ · edited · deleted   │
│                                                │ │ typing… indicator              │
│                                                │ ├────────────────────────────────│
│                                                │ │ paste-image hint               │
│                                                │ │ ( input …            🙂 🖼️ 📎 ➤)│
└────────────────────────────────────────────────┴──────────────────────────────────┘
```
- **Sidebar split** into **Channels** (`#`, unread badge) and **Direct Messages** (avatar + presence dot), each with a `+`.
- **Message grouping**: consecutive messages from the same author merge — avatar + name shown once, bubbles stacked tight, one timestamp for the run. Own messages align right (`bg-primary`), others left (`bg-muted`).
- **Composer**: single rounded pill, ghost icons inline right — emoji picker (🙂, inserts unicode), image (🖼️), attach (📎), send (➤). No boxed buttons, no always-on emoji bar.
- **Attachments**: images render **inline** as a thumbnail with hover **⧉ Copy** + click-to-zoom; **paste image (⌘V)** and drag-drop attach from the composer. Non-image MIME types render as a **download chip only** (never inline).

## new-conversation overlay (state 6)
Centered modal (dimmed backdrop), opened by `+ New` or the sidebar search — searches **all** people/channels, including ones never messaged:
- input + `Esc`; tabs All / People / Channels.
- **People** → `Message` (start/reuse DM). **Channels** → `Open` (joined) / `Join` (not). Bottom: **Create channel "<query>"**.
- no-match state (6b).

## states (scroll the mockup)
`0 access` · `1 filled` · `2 message states` (sending/sent ✓/read ✓✓/edited/deleted placeholder/inline-image+copy/file-chip) · `3 empty` (no conversations / no messages) · `4 loading` (sidebar skeletons + thread spinner) · `5 error` (thread load fail + retry) · `6 search overlay` + `6b no-match`.

## Components to reuse (real path:symbol)
- Visual template — planner chat: `src/components/planner/ChatMessage.tsx`, `ChatMessageList.tsx`, `ChatInput.tsx`, `ChatAttachment.tsx` (adapt AI-chat → user-to-user; keep bubble/list styling).
- shadcn primitives: `src/components/ui/dialog.tsx` (overlay), `input.tsx`, `button.tsx`, `avatar.tsx`, `scroll-area.tsx`, `badge.tsx`.
- Nav: extend `src/components/layout/AppSidebar.tsx` (add Chat item, mirror the "My Tasks" item pattern at ~line 170).
- Icons: `lucide-react` (MessageSquare, Hash, Smile, Paperclip, Image, Send, Search).
- No new component library — reuse the above; build minimal only where none fits.
