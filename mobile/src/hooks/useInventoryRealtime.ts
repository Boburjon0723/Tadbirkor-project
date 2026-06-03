import { useEffect, useRef } from 'react';
import { DeviceEventEmitter } from 'react-native';
import { INVENTORY_CHANGED, InventoryChangedPayload } from '../lib/inventory-events';
import { subscribeInventorySocket } from '../lib/inventory-socket';

type Options = {
  enabled?: boolean;
  warehouseId?: string | null;
  debounceMs?: number;
  onChanged: (payload: InventoryChangedPayload) => void;
};

export function useInventoryRealtime({
  enabled = true,
  warehouseId,
  debounceMs = 450,
  onChanged,
}: Options) {
  const onChangedRef = useRef(onChanged);
  onChangedRef.current = onChanged;

  useEffect(() => {
    if (!enabled) return;

    const unsubscribeSocket = subscribeInventorySocket();
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (payload: InventoryChangedPayload) => {
      const wid = String(payload?.warehouseId || '').trim();
      if (warehouseId && wid && wid !== warehouseId) return;

      if (timer) clearTimeout(timer);
      timer = setTimeout(() => onChangedRef.current(payload), debounceMs);
    };

    const sub = DeviceEventEmitter.addListener(INVENTORY_CHANGED, schedule);

    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
      unsubscribeSocket();
    };
  }, [enabled, warehouseId, debounceMs]);
}
