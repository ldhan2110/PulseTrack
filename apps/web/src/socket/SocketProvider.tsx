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
