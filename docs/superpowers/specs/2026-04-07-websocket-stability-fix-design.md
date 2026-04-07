# WebSocket Connection Stability Fix

**Date:** 2026-04-07
**Status:** Approved
**Approach:** B — Vite proxy + module-level socket singleton

## Problem

WebSocket connection to `ws://localhost:5173/socket.io/?EIO=4&transport=websocket` fails because:

1. **Missing Vite proxy**: Only `/api` is proxied to `localhost:3000`. Socket.IO requests to `/socket.io` hit the Vite dev server (port 5173) instead of the NestJS backend (port 3000).
2. **Unstable SocketProvider**: Socket is created during the render phase and `socket.disconnect()` is called on cleanup, causing connection churn on re-renders and React StrictMode double-mounts.
3. **Stale auth token**: Keycloak token is captured once at socket creation time with no proactive refresh mechanism.

## Solution

### 1. Add Vite Proxy for Socket.IO

**File:** `apps/web/vite.config.ts`

Add a `/socket.io` entry to the proxy config with WebSocket support enabled:

```typescript
proxy: {
  '/api': {
    target: 'http://localhost:3000',
    changeOrigin: true,
  },
  '/socket.io': {
    target: 'http://localhost:3000',
    changeOrigin: true,
    ws: true,
  },
},
```

This ensures all Socket.IO traffic (both HTTP long-polling handshake and WebSocket upgrade) is forwarded to the NestJS backend.

### 2. Module-Level Socket Singleton

**File:** `apps/web/src/socket/instance.ts` (new)

Extract socket creation into a module-level singleton factory:

```typescript
import { io, Socket } from 'socket.io-client';
import keycloak from '../auth/keycloak';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io('/', {
      auth: { token: keycloak.token },
      transports: ['websocket'],
      autoConnect: false,
    });
  }
  return socket;
}
```

Key decisions:
- **`autoConnect: false`**: Socket is created eagerly but connected explicitly in the provider's `useEffect`, preventing connection attempts before the component tree is ready.
- **Module-level singleton**: The socket instance lives outside React's lifecycle, so it is unaffected by re-renders, StrictMode double-mounts, or hot module replacement.
- **`transports: ['websocket']`**: Skip HTTP long-polling; connect directly via WebSocket since the Vite proxy supports it.

### 3. Simplified SocketProvider

**File:** `apps/web/src/socket/SocketProvider.tsx` (refactored)

```typescript
import { createContext, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import keycloak from '../auth/keycloak';
import { getSocket } from './instance';

export const SocketContext = createContext<Socket | null>(null);

interface SocketProviderProps {
  children: React.ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const socket = getSocket();

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    function handleConnectError(err: Error) {
      if (
        err.message === 'Unauthorized' ||
        err.message.toLowerCase().includes('auth') ||
        (err as unknown as { data?: { type?: string } }).data?.type ===
          'UnauthorizedError'
      ) {
        socket.auth = { token: keycloak.token };
        socket.connect();
      }
    }

    socket.on('connect_error', handleConnectError);

    return () => {
      socket.off('connect_error', handleConnectError);
      // No socket.disconnect() — singleton lives for the app session
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}
```

Changes from current implementation:
- Removed `useRef` — replaced by module-level singleton via `getSocket()`
- Removed `socket.disconnect()` from cleanup — the singleton persists for the entire browser session
- Added `if (!socket.connected)` guard before connecting — prevents redundant connect calls on StrictMode remounts
- Kept the `connect_error` handler for token refresh on auth failures

### 4. No Changes Required

These files require no modifications:
- `apps/web/src/socket/useSocket.ts` — still consumes `SocketContext`, no change needed
- `apps/web/src/hooks/useMembershipSync.ts` — still uses `useSocket()`, no change needed
- `apps/web/src/main.tsx` — provider ordering stays the same
- Backend gateway/auth — already correctly configured

## Files Changed

| File | Action | Description |
|------|--------|-------------|
| `apps/web/vite.config.ts` | Edit | Add `/socket.io` proxy with `ws: true` |
| `apps/web/src/socket/instance.ts` | Create | Module-level socket singleton factory |
| `apps/web/src/socket/SocketProvider.tsx` | Edit | Use singleton, remove disconnect cleanup, add connect guard |

## What This Fixes

| Issue | Before | After |
|-------|--------|-------|
| Connection target | Hits Vite on :5173 | Proxied to NestJS on :3000 |
| StrictMode double-mount | Disconnects and reconnects | Singleton unaffected |
| Re-render churn | Socket created in render phase | Stable module-level reference |
| Token refresh | Only on connect_error | Same (sufficient for current needs) |

## Testing

1. Start backend (`localhost:3000`) and frontend (`localhost:5173`)
2. Open browser DevTools Network tab, filter by WS
3. Verify WebSocket connects to `ws://localhost:5173/socket.io/...` and is proxied to backend
4. Verify no repeated connect/disconnect cycles in console
5. Trigger a membership change and verify `member:added`/`member:removed` events are received
