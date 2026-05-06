import { io, Socket } from 'socket.io-client';
import keycloak from '../auth/keycloak';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || '/', {
      path: import.meta.env.VITE_SOCKET_PATH || '/socket.io',
      auth: { token: keycloak.token },
      transports: ['websocket'],
      autoConnect: false,
    });
  }
  return socket;
}
