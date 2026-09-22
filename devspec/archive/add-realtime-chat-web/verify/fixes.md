# Verify: add-realtime-chat-web  (app vs mockup) — PASS

App live at http://localhost:5173/chat, logged in as anle. No mismatches.

## chat — PASS
Screens/states walked (screenshots in this dir):
- **empty**  (chat-empty.png) — sidebar Chat item present beside My Tasks; page header "Chat", New button, search box, empty-state CTA all render.
- **overlay** (chat-overlay.png) — New opens shadcn Dialog: title, search, Tabs All/People/Channels, "Create channel" affordance.
- **filled** (chat-filled.png) — created channel "verify-smoke", sent a message; grouped bubble renders, composer pill with emoji/image/attach/send ghost icons.

Structural (rung 1): all regions/controls present via snapshot -i.
Visual (rung 2): computed styles are project tokens, not UA-default —
- New button: background-color oklch(0.205 0 0) [--primary], border-radius 8px, flex/centered, weight 500.
- Composer pill: border 1px solid, display flex, align-items center, bg [--background].
- Own message bubble: background-color oklch(0.205 0 0) [--primary], padding 12px 8px.
Reuse confirmed: shadcn Button/Badge/Avatar/Dialog/Tabs/Input/ScrollArea/Skeleton/Popover throughout (no hand-rolled plain elements).

Not exercised by a single-session walk (covered elsewhere, not gaps):
- pagination: thread has <30 messages, no page-2 boundary to walk (infinite-scroll-up code + preserve-scroll present).
- presence dot / typing indicator / read-receipt ✓✓: require a second live user — unit-covered by useChatSync.test (presence cache) + useChat.test.
- inline-image thumbnail + copy: unit-covered by MessageAttachment.test (image→<img>+copy, pdf→chip).
