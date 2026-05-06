import { createContext, useContext, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { AuthContext } from '../auth/AuthProvider';
import { getSocket } from './instance';

export const SocketContext = createContext<Socket | null>(null);

interface SocketProviderProps {
  children: React.ReactNode;
}

export function SocketProvider({ children }: SocketProviderProps) {
  const auth = useContext(AuthContext);
  const socket = getSocket();

  useEffect(() => {
    if (!auth?.token) return;

    // Update auth token and (re)connect
    socket.auth = { token: auth.token };
    if (socket.connected) {
      // Token refreshed — reconnect so gateway re-authenticates
      socket.disconnect().connect();
    } else {
      socket.connect();
    }
  }, [socket, auth?.token]);

  return (
    <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
  );
}
