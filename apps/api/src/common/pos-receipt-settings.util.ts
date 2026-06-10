export type PosReceiptFormat = 'thermal' | 'a4' | 'none';

export interface PosReceiptSettings {
  /** Savdo yakunlanganda avtomatik chop etish */
  autoPrint: boolean;
  /** thermal = 58/80mm, a4 = invoys, none = cheksiz */
  receiptFormat: PosReceiptFormat;
}

export const DEFAULT_POS_RECEIPT_SETTINGS: PosReceiptSettings = {
  autoPrint: true,
  receiptFormat: 'thermal',
};

export function normalizePosReceiptSettings(
  raw?: Partial<PosReceiptSettings> | null,
): PosReceiptSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_POS_RECEIPT_SETTINGS };
  }
  const fmt = String(raw.receiptFormat || '').toLowerCase();
  const receiptFormat: PosReceiptFormat =
    fmt === 'a4' ? 'a4' : fmt === 'none' ? 'none' : 'thermal';
  return {
    autoPrint:
      raw.autoPrint !== undefined
        ? Boolean(raw.autoPrint)
        : DEFAULT_POS_RECEIPT_SETTINGS.autoPrint,
    receiptFormat,
  };
}

export function mergePosReceiptSettingsPatch(
  current: PosReceiptSettings,
  patch: Partial<PosReceiptSettings>,
): PosReceiptSettings {
  return normalizePosReceiptSettings({ ...current, ...patch });
}
