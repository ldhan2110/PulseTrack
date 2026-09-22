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

## INTERNAL user name/email/imageUrl overwritten from Keycloak every login
_captured: 2026-09-22_

`jwt.strategy.ts:75-90` re-syncs `name`, `email`, `imageUrl` from the Keycloak
user-info claim on **every** INTERNAL login. Any local edit to those fields on
an INTERNAL user is clobbered on next login.

Self-service profile edits (name/avatar) are therefore only meaningful for
`userType === 'EXTERNAL'` users, who have no Keycloak source of truth (their
name/imageUrl are set at invite and never otherwise updated). Gate profile
edit endpoints/UI on `EXTERNAL`; show INTERNAL a read-only "Managed by SSO"
view.

Also note: `GET /users/me` (`users.controller.ts:16`) returns `req.user` raw —
it leaks `passwordHash`/`pwResetTokenHash`/`pwResetTokenExp`. The login path
strips them (`auth.service.ts:62`); `/users/me` does not.
