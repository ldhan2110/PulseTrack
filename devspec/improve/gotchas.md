<!-- Traps, env quirks, ordering, known-broken things to avoid. -->

## Chat `/chat` socket has per-conversation rooms only — no per-user room
_captured: 2026-09-22_

The `/chat` socket namespace uses per-conversation rooms `convo:{id}` only; a
socket joins one on open/send via the `chat:join` handler
(`apps/api/src/chat/chat.gateway.ts`). There is **no** per-user room by default.

To deliver an event to a user who does **not** have the conversation open
(e.g. added-to-channel, @mention notify), a `convo:{id}` emit won't reach them.
Add a `user:{id}` room joined in `ChatGateway.handleConnection`, plus a
`ChatService.emitToUser(userId, event, payload)` helper mirroring the existing
`emitToConvo`. (Introduced by change `chat-members-mentions`.)
