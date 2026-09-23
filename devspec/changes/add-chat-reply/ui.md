# UI: add-chat-reply

**Mockups**: `mockups/chat-reply.html` (approved 2026-09-23)
**References**: sibling of existing chat thread `src/components/chat/MessageThread.tsx` + `MessageRow.tsx`; matches existing bubble/toolbar patterns.
**Style source**: shadcn default tokens already used by the chat (`bg-primary`, `bg-muted`, `text-muted-foreground`, `text-primary-foreground`, `rounded-xl`, `border`, `ring`, `bg-destructive`); mention blue mirrors existing `@[Name](userId)` render in `MessageRow.tsx:16`. Mockup inlines approximate hex; real build uses the project's CSS vars / Tailwind classes.

## chat thread (reply additions to existing components)

### Reply action (`MessageRow`)
- New `↩ Reply` button joins the hover toolbar (`group-hover/msg`). Own messages: `Reply · Edit · Delete`. Others' messages: gain a toolbar (today none) with `Reply · React`.
- Reply available on **every** message — own and others, DM and channel.
- Click → sets composer reply-target (lifts state to `MessageThread`).

### Quoted parent (`MessageRow`)
- When `message.replyTo` present, render a compact preview **above** the bubble body:
  - `<q-name>` author (`replyTo.author.name`, "You" if self) + `<q-body>` one-line truncated `replyTo.body` (ellipsis).
  - Accent left-border, `bg-muted` (darker tint inside own primary bubble), `cursor-pointer`.
  - Mention tokens in the preview body render as plain `@Name` (reuse existing strip, no nesting).
- `replyTo.deletedAt` set → body shows `message deleted` (italic), not stale text; click disabled.
- Click a live preview → scroll to original + flash.

### Reply banner (`Composer`)
- Reply-target set → banner above the input: `Replying to <name>: <preview>` + `✕` cancel.
- `✕` or `Escape` clears target. Sending clears target. Send payload carries `replyToId`.

### Scroll-to-original + flash (`MessageThread`)
- Each rendered message carries a scroll anchor (`data-msg-id` / `id`) — none today.
- Click quoted preview → find anchor in DOM → `scrollIntoView({behavior:'smooth'})` + transient highlight class (yellow → fade ~1.4s).
- Parent **not in loaded page** (older history, infinite scroll) → v1 no-op or small "not loaded" toast. Deep-history fetch-until-found deferred (out of scope).

States: default (no reply) | reply-target set (banner) | quoted parent (live) | quoted parent (deleted) | scroll-flash.

## Components to reuse (real path:symbol)
- `MessageRow` (`src/components/chat/MessageRow.tsx`) — add reply btn + quoted-parent block.
- `Composer` (`src/components/chat/Composer.tsx`) — add reply banner; extend `send.mutate` payload with `replyToId`.
- `MessageThread` (`src/components/chat/MessageThread.tsx`) — owns `replyTarget` state, scroll-to handler, message anchors.
- `Input` (`src/components/ui/input.tsx`), existing toolbar buttons — reuse, no new primitives.

## Verify
`/devspec-verify add-chat-reply` (agent-browser @ localhost:5173, anle@) — reply btn present on hover, quoted parent renders above reply, banner shows on reply + clears on cancel/send, click quoted scrolls+flashes. Plus `MANUAL: BA approves screenshot` visual gate.
