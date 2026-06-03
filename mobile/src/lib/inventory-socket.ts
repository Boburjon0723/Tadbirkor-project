import { io, Socket } from 'socket.io-client';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { currentApiUrl } from '../api/client';
import { emitInventoryChanged, InventoryChangedPayload } from './inventory-events';

let socket: Socket | null = null;
let listenerCount = 0;

function getSocketOrigin() {
  return currentApiUrl.replace(/\/api\/?$/, '');
}

export async function connectInventorySocket(): Promise<Socket | null> {
  const token = await AsyncStorage.getItem('token');
  if (!token) return null;

  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }

  const origin = getSocketOrigin();
  socket = io(`${origin}/inventory`, {
    transports: ['websocket'],
    auth: { token },
  });

  socket.on('inventory:changed', (payload: InventoryChangedPayload) => {
    emitInventoryChanged(payload);
  });

  return socket;
}

export function subscribeInventorySocket(onConnect?: () => void) {
  listenerCount += 1;
  void connectInventorySocket().then((s) => {
    if (s?.connected) onConnect?.();
    else s?.once('connect', () => onConnect?.());
  });

  return () => {
    listenerCount = Math.max(0, listenerCount - 1);
    if (listenerCount === 0) {
      socket?.disconnect();
      socket = null;
    }
  };
}
