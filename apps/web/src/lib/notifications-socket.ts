import { io, Socket } from 'socket.io-client';
import { getSocketOrigin } from './api';
import { getAuthToken } from './auth-token';

let socket: Socket | null = null;

export function getNotificationsSocket() {
  if (typeof window === 'undefined') return null;
  if (socket) return socket;

  const token = getAuthToken();
  socket = io(`${getSocketOrigin()}/notifications`, {
    transports: ['websocket'],
    withCredentials: true,
    auth: token ? { token } : undefined,
  });

  return socket;
}

export function disconnectNotificationsSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
