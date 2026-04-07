import { createContext, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import keycloak from '../auth/keycloak';

export const SocketContext = createContext<Socket | null>(null);

interface SocketProviderProps {
  children: React.ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const socketRef = useRef<Socket | null>(null);

  if (!socketRef.current) {
    socketRef.current = io('/', {
      auth: { token: keycloak.token },
      transports: ['websocket'],
      autoConnect: true,
    });
  }

  useEffect(() => {
    const socket = socketRef.current!;

    function handleConnectError(err: Error) {
      if (
        err.message === 'Unauthorized' ||
        err.message.toLowerCase().includes('auth') ||
        (err as unknown as { data?: { type?: string } }).data?.type === 'UnauthorizedError'
      ) {
        socket.auth = { token: keycloak.token };
        socket.connect();
      }
    }

    socket.on('connect_error', handleConnectError);

    return () => {
      socket.off('connect_error', handleConnectError);
      socket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  );
}
