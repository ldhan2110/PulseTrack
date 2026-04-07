# Real-Time Membership Sync — Design Spec

**Date:** 2026-04-07
**Scope:** Phase 1 — add/remove user from project, sidebar and navigation react in real-time

---

## Problem

When a PM adds or removes a user from a project, the affected user's browser has no awareness of the change until they refresh. The sidebar project list is stale, and if they're actively viewing the removed project they continue to see it uninterrupted — which is misleading and will cause permission errors on subsequent API calls.

---

## Goals

- Removed user is immediately redirected to home (`/`) with a toast warning
- Added user sees the new project silently appear in the sidebar (no interruption)
- Socket auth is isolated behind a swappable service — replacing Keycloak with internal DB auth requires changing only one file
- CORS is fully open (`origin: '*'`) — internal tool, no credential cookies needed (auth is Bearer token in handshake)

---

## Architecture

```
Browser (affected user)              NestJS Backend
────────────────────────             ─────────────────────────────────────
SocketProvider (root)                NotificationsGateway
  socket.io-client                     handleConnection()
    auth: { token: jwt }   ←──WS──→     → SocketAuthService.extractUser()
    joins room: user:{id}                → socket.join(`user:${userId}`)
                                         → disconnect if auth fails
useMembershipSync (hook)             NotificationsService
  on 'member:removed':                 notifyUser(userId, event, data)
    invalidate ['projects']              → server.to(`user:${userId}`).emit(...)
    if on affected project:
      navigate('/')                  MembersService (modified)
      toast warning                    addMember() → notifyUser('member:added')
  on 'member:added':                   removeMember() → notifyUser('member:removed')
    invalidate ['projects']
                                     SocketAuthService (swappable)
                                       extractUserFromHandshake(handshake)
                                         today: verify JWT, return sub claim
                                         future: query internal DB
```

---

## Backend

### New: `NotificationsModule`

Location: `apps/api/src/notifications/`

**`SocketAuthService`**

Sole responsibility: extract and verify a userId from a socket handshake. Today it reads `handshake.auth.token`, verifies it as a JWT using the same secret as the REST guard, and returns the `sub` claim (userId). If verification fails, returns `null`.

This is the **only** file that knows about Keycloak. Swapping to internal DB auth means replacing only this class — the gateway, service, and all callers are untouched.

**`NotificationsGateway`**

```ts
@WebSocketGateway({ cors: { origin: '*' } })
```

- `handleConnection(socket)`: calls `SocketAuthService`, disconnects on null, stores `userId` in `socket.data.userId`, joins room `user:{userId}`
- `handleDisconnect(socket)`: no-op — Socket.IO auto-cleans rooms
- No inbound events handled — this gateway only emits

Decorated with `@WebSocketServer()` to get the server instance, which is passed to `NotificationsService`.

**`NotificationsService`**

Injectable service with a single public method:

```ts
notifyUser(userId: string, event: string, data: unknown): void
```

Emits to the Socket.IO room `user:{userId}`. Any module that injects `NotificationsService` can send targeted notifications without knowing anything about sockets.

### Modified: `MembersService`

Two additions — no logic changes:

- After `addMember` / `addMembers` succeed: emit `member:added` to the added user(s) with `{ projectId, projectName }`
- After `removeMember` succeeds: emit `member:removed` to the removed user with `{ projectId }`

The removed user's `userId` is already available from the existing `findFirst` call — no extra DB query.

### Modified: `main.ts`

```ts
app.enableCors({ origin: '*' });
```

Note: `credentials: true` is omitted — browsers reject `origin: '*'` combined with credentials. Auth is via Bearer token in the socket handshake, so cookies are not needed.

---

## Frontend

### New: `SocketProvider`

Location: `apps/web/src/socket/SocketProvider.tsx`

Creates and manages a single `socket.io-client` instance for the app lifetime. Connects with the current Keycloak JWT in `auth: { token }`. This is the only place in the frontend that knows about Keycloak-as-socket-auth — swapping auth means changing only this file.

```ts
const socket = io('/', {
  auth: { token: keycloak.token },
  transports: ['websocket'],
})
```

Mounted in `main.tsx`, wrapping the app outside the router but inside `QueryClientProvider`. Exposes the socket via React context.

Token refresh: if Keycloak rotates the token, the provider disconnects and reconnects with the new token so the handshake stays valid.

### New: `useSocket`

Location: `apps/web/src/socket/useSocket.ts`

Thin hook — returns the socket instance from context. Used by any hook or component that needs to subscribe to events without prop drilling.

### New: `useMembershipSync`

Location: `apps/web/src/hooks/useMembershipSync.ts`

Mounted once inside `ProjectLayout` (covers all authenticated project pages). Subscribes to:

**`member:removed` `{ projectId }`**
1. Read the cached `['projects']` query to resolve `projectId → prefix` (no extra fetch)
2. Invalidate `['projects']` — sidebar project list will refetch
3. Invalidate `['project', projectId]`
4. Check if current path starts with `/projects/{prefix}`
5. If yes: `navigate('/')` + `toast.warning('You were removed from this project')`

**`member:added` `{ projectId, projectName }`**
1. Invalidate `['projects']` — new project silently appears in sidebar

The hook uses `useNavigate`, `useLocation`, `useQueryClient`, and `useSocket`. No new dependencies required.

---

## Event Payload Contracts

```ts
// member:added
{ projectId: string; projectName: string }

// member:removed
{ projectId: string }
```

Payloads are minimal — the frontend refetches full data via React Query invalidation rather than trusting the event payload for rendering.

---

## Files Changed

### New
| File | Purpose |
|------|---------|
| `apps/api/src/notifications/notifications.gateway.ts` | WebSocket gateway, room management |
| `apps/api/src/notifications/notifications.service.ts` | `notifyUser()` emitter |
| `apps/api/src/notifications/socket-auth.service.ts` | JWT extraction, swappable auth layer |
| `apps/api/src/notifications/notifications.module.ts` | Module wiring |
| `apps/web/src/socket/SocketProvider.tsx` | Root socket context provider |
| `apps/web/src/socket/useSocket.ts` | Hook to access socket instance |
| `apps/web/src/hooks/useMembershipSync.ts` | Membership event handler |

### Modified
| File | Change |
|------|--------|
| `apps/api/src/members/members.service.ts` | Inject `NotificationsService`, emit after add/remove |
| `apps/api/src/members/members.module.ts` | Import `NotificationsModule` |
| `apps/api/src/app.module.ts` | Import `NotificationsModule` |
| `apps/api/src/main.ts` | `enableCors({ origin: '*' })` |
| `apps/web/src/main.tsx` | Wrap app in `SocketProvider` |
| `apps/web/src/components/layout/ProjectLayout.tsx` | Mount `useMembershipSync` |

---

## Dependencies

**Backend:** All packages already installed — `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`

**Frontend:** `socket.io-client` must be added:
```
pnpm --filter web add socket.io-client
```

---

## Out of Scope (this phase)

- Real-time task assignment notifications
- Real-time comment notifications
- Live members page update for PMs (showing other users being added/removed in real time)
- Horizontal scaling (Redis Socket.IO adapter) — not needed for single-server on-premise POC
