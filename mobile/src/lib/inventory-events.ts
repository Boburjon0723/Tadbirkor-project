import { DeviceEventEmitter } from 'react-native';

export const INVENTORY_CHANGED = 'inventory_changed';

export type InventoryChangedPayload = {
  warehouseId?: string;
  productVariantId?: string;
  reason?: string;
};

export function emitInventoryChanged(payload?: InventoryChangedPayload) {
  DeviceEventEmitter.emit(INVENTORY_CHANGED, payload ?? {});
}
