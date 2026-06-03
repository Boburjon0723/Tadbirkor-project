/** Mahsulot kodi (SKU) — nomdan taxmin qilish (variantda SKU bo‘lmasa) */
export function inferProductSkuFromName(
  name: string,
  explicitSku?: string,
): string {
  const sku = String(explicitSku || '').trim();
  if (sku) return sku;

  const n = String(name || '').trim();
  if (!n) return '';

  const slash = n.match(/^([A-Za-z0-9][A-Za-z0-9._-]*)\s*\/\s*(.+)$/);
  if (slash) return slash[1].trim();

  if (/^[A-Za-z]{1,6}[-_]?\d{2,}[A-Za-z0-9/-]*$/i.test(n)) {
    return n;
  }

  return '';
}
