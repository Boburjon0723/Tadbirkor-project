/** B2B qabul / mapping — mahsulot kodi (SKU, barcode) */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidLike(value?: string | null): boolean {
  return UUID_RE.test(String(value || '').trim());
}

/** Snapshot oxiridagi `[A-001]` */
export function extractSkuFromSnapshot(snapshot?: string | null): string | null {
  const m = String(snapshot || '')
    .trim()
    .match(/\[\s*([^\]]+?)\s*\]\s*$/u);
  return m ? m[1].trim() : null;
}

export function stripTrailingSkuBracket(snapshot?: string | null): string {
  return String(snapshot || '')
    .trim()
    .replace(/\s*\[[^\]]+\]\s*$/u, '')
    .trim();
}

export function parseSnapshotParts(snapshot: string): {
  productName: string;
  variantName: string;
} {
  const cleaned = stripTrailingSkuBracket(snapshot);
  const parts = cleaned.split(/\s+[-–—]\s+/);
  const head = (parts[0]?.trim() || cleaned).trim();
  let tail = parts.slice(1).join(' — ').trim();
  const m = tail.match(/^(.+?)\s*\(([^)]+)\)\s*$/u);
  if (m && m[1].trim().toLowerCase() === m[2].trim().toLowerCase()) {
    tail = m[1].trim();
  }
  return {
    productName: head || cleaned,
    variantName: tail || 'Standart',
  };
}

/** BX-109, A-001 kabi kodlar (mahsulot nomi emas) */
export function looksLikeProductCode(value?: string | null): boolean {
  const t = String(value || '').trim();
  if (!t || t.length > 48 || /\s/.test(t)) return false;
  return /^[A-Za-z]{1,6}-[\dA-Za-z][\dA-Za-z-]*$/u.test(t) || /^[A-Z]{0,4}\d{2,10}$/iu.test(t);
}

/** Qabul qatorida SKU qidiruv uchun barcha kodlar (tartib muhim) */
export function collectInboundSkuCandidates(
  snapshot: string,
  sellerVariant?: { sku?: string | null; barcode?: string | null } | null,
): string[] {
  const out: string[] = [];
  const push = (v?: string | null) => {
    const t = String(v || '').trim();
    if (!t) return;
    if (out.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    out.push(t);
  };

  push(sellerVariant?.sku);
  push(sellerVariant?.barcode);
  push(extractSkuFromSnapshot(snapshot));

  const { productName } = parseSnapshotParts(snapshot);
  if (looksLikeProductCode(productName)) {
    push(productName);
  }

  return out;
}

export function findVariantBySkuCodes<
  T extends { id: string; sku?: string | null; barcode?: string | null },
>(variants: T[], codes: string[]): T | null {
  for (const code of codes) {
    const low = code.toLowerCase();
    const hit = variants.find(
      (v) =>
        v.sku?.trim().toLowerCase() === low || v.barcode?.trim().toLowerCase() === low,
    );
    if (hit) return hit;
  }
  return null;
}
