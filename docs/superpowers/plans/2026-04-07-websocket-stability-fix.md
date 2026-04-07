# WebSocket Stability Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix WebSocket connection failing against Vite dev server and eliminate reconnection churn from React re-renders.

**Architecture:** Add Vite proxy for `/socket.io` path, extract socket creation into a module-level singleton, and simplify the SocketProvider to use it without disconnect-on-cleanup.

**Tech Stack:** Socket.IO client, Vite proxy, React context

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/vite.config.ts` | Modify | Add `/socket.io` proxy entry with `ws: true` |
| `apps/web/src/socket/instance.ts` | Create | Module-level socket singleton factory |
| `apps/web/src/socket/SocketProvider.tsx` | Modify | Consume singleton, remove disconnect cleanup |

---

### Task 1: Add Vite Proxy for Socket.IO

**Files:**
- Modify: `apps/web/vite.config.ts:23-28`

- [ ] **Step 1: Add `/socket.io` proxy entry**

In `apps/web/vite.config.ts`, add the `/socket.io` proxy below the existing `/api` proxy:

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

- [ ] **Step 2: Commit**

```bash
git add apps/web/vite.config.ts
git commit -m "fix: add Vite proxy for Socket.IO WebSocket connections"
```

---

### Task 2: Create Socket Singleton

**Files:**
- Create: `apps/web/src/socket/instance.ts`

- [ ] **Step 1: Create the singleton module**

Create `apps/web/src/socket/instance.ts`:

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

Key points:
- `autoConnect: false` prevents connection before the React tree is ready
- Module-level `socket` variable survives re-renders and StrictMode double-mounts
- `io('/')` connects to same origin — Vite proxy (Task 1) forwards to backend

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/socket/instance.ts
git commit -m "feat: add module-level Socket.IO singleton factory"
```

---

### Task 3: Refactor SocketProvider to Use Singleton

**Files:**
- Modify: `apps/web/src/socket/SocketProvider.tsx`

- [ ] **Step 1: Rewrite SocketProvider**

Replace the entire contents of `apps/web/src/socket/SocketProvider.tsx` with:

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
    };
  }, [socket]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}
```

Changes from previous version:
- Removed `useRef` — replaced by `getSocket()` singleton
- Removed `socket.disconnect()` from cleanup — singleton persists for app lifetime
- Added `if (!socket.connected)` guard — prevents redundant connect on StrictMode remount
- `useEffect` depends on `[socket]` (stable reference from singleton)

- [ ] **Step 2: Verify no other imports of `io` from socket.io-client exist in consumer code**

Run: `grep -r "from 'socket.io-client'" apps/web/src/ --include="*.ts" --include="*.tsx"`

Expected: Only `apps/web/src/socket/instance.ts` imports `io`. `SocketProvider.tsx` imports only `Socket` (the type). `useSocket.ts` doesn't import from socket.io-client at all.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/socket/SocketProvider.tsx
git commit -m "fix: refactor SocketProvider to use singleton, remove disconnect cleanup"
```

---

### Task 4: Smoke Test

- [ ] **Step 1: Start backend and frontend**

```bash
# Terminal 1 — backend
cd apps/api && pnpm dev

# Terminal 2 — frontend
cd apps/web && pnpm dev
```

- [ ] **Step 2: Verify WebSocket connects through proxy**

1. Open browser to `http://localhost:5173`
2. Open DevTools → Network tab → filter by "WS"
3. Verify a WebSocket connection to `ws://localhost:5173/socket.io/?EIO=4&transport=websocket` is established and stays open (status 101)
4. Verify no repeated connect/disconnect cycles in the console

- [ ] **Step 3: Verify no console errors**

Check browser console for:
- No `WebSocket is closed before the connection is established` errors
- No repeated `connect_error` events (unless backend is actually down)
