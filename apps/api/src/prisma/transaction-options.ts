/** Ko‘p tranzaksiyalar uchun (o‘chirish, yaratish, stock) — P2028 oldini olish */
export const DEFAULT_TX_OPTIONS = {
  maxWait: 15_000,
  timeout: 30_000,
} as const;

/** Import, checkout, dispatch kabi uzoq jarayonlar */
export const LONG_TX_OPTIONS = {
  maxWait: 20_000,
  timeout: 60_000,
} as const;

/** POS to‘lov — qisqa tranzaksiya, ReadCommitted (kassa tezligi) */
export const POS_CHECKOUT_TX_OPTIONS = {
  maxWait: 10_000,
  timeout: 30_000,
  isolationLevel: 'ReadCommitted' as const,
} as const;

/** Yuk qabul (ko‘p qator): P2028 «bazasi band» oldini olish */
export function receiptAcceptTxOptions(lineCount: number) {
  const lines = Math.max(0, lineCount);
  return {
    maxWait: Math.min(90_000, 25_000 + lines * 50),
    timeout: Math.min(600_000, 90_000 + lines * 250),
    isolationLevel: 'ReadCommitted' as const,
  };
}

/** Bir chunk (≈35 qator) uchun qisqa tranzaksiya */
export const RECEIPT_ACCEPT_CHUNK_SIZE = 35;

/** Inventarizatsiya boshlash / blok yechish — HTTP timeout (≈10s) dan qisqa bo‘lishi kerak */
export const INVENTORY_BLOCK_CHUNK_SIZE = 35;
