/** Excel import preview — maksimal qator (xotira himoyasi). */
export function getImportPreviewMaxRows(): number {
  const n = Number(process.env.IMPORT_PREVIEW_MAX_ROWS || 2500);
  return Number.isFinite(n) && n >= 100 && n <= 10_000 ? Math.floor(n) : 2500;
}

/** Confirm / navbat — bitta so‘rovdagi maksimal qator. */
export function getImportConfirmMaxRows(): number {
  const n = Number(process.env.IMPORT_CONFIRM_MAX_ROWS || 5000);
  return Number.isFinite(n) && n >= 200 && n <= 20_000 ? Math.floor(n) : 5000;
}

/** Yuk qabul — bir hujjatdagi maksimal qator (accept/partial). */
export function getReceiptMaxAcceptLines(): number {
  const n = Number(process.env.RECEIPT_MAX_ACCEPT_LINES || 800);
  return Number.isFinite(n) && n >= 50 && n <= 3000 ? Math.floor(n) : 800;
}
