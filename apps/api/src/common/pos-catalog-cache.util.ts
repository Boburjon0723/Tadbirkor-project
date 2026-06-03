/** Redis / in-memory: `pos:catalog:{companyId}:{warehouseId}:...` */
export function posCatalogCachePrefix(
  companyId: string,
  warehouseId?: string | null,
): string {
  const cid = String(companyId || '').trim();
  const wid = String(warehouseId || '').trim();
  if (wid) return `pos:catalog:${cid}:${wid}:`;
  return `pos:catalog:${cid}:`;
}
