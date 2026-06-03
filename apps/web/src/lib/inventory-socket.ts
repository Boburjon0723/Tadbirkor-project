import { io, Socket } from 'socket.io-client';
import { getSocketOrigin } from './api';
import { getAuthToken } from './auth-token';

let socket: Socket | null = null;

export function getInventorySocket() {
  if (typeof window === 'undefined') return null;
  if (socket) return socket;

  const token = getAuthToken();
  socket = io(`${getSocketOrigin()}/inventory`, {
    transports: ['websocket'],
    withCredentials: true,
    auth: token ? { token } : undefined,
  });

  return socket;
}

export function disconnectInventorySocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
