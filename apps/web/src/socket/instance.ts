import { io, Socket } from 'socket.io-client';
import keycloak from '../auth/keycloak';

let socket: Socket | null = null;
let chatSocket: Socket | null = null;

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

// Sibling socket on the '/chat' namespace (backend ChatGateway). Same Keycloak
// auth + path as getSocket(); kept independent so chat traffic and notification
// traffic don't share a connection.
export function getChatSocket(): Socket {
  if (!chatSocket) {
    const base = import.meta.env.VITE_SOCKET_URL || '';
    chatSocket = io(`${base}/chat`, {
      path: import.meta.env.VITE_SOCKET_PATH || '/socket.io',
      auth: { token: keycloak.token },
      transports: ['websocket'],
      autoConnect: false,
    });
  }
  return chatSocket;
}
