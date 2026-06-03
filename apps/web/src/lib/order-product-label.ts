/** Buyurtma / jo‘natma / qabul qilish — mahsulot qator matni */

const DASH_SPLIT = /\s+[-–—]\s+/;

/** Variant nomi + rang: "Qora (Qora)" bo‘lmasin — rang nom bilan bir xil bo‘lsa qavs qo‘shilmaydi */
export function formatVariantLabel(
  variantName: string,
  color?: string | null,
): string {
  const name = String(variantName || '').trim();
  const col = String(color || '').trim();
  if (!name) return col;
  if (!col || col.toLowerCase() === name.toLowerCase()) return name;
  if (name.toLowerCase().endsWith(`(${col.toLowerCase()})`)) return name;
  return `${name} (${col})`;
}

/** Snapshot oxiridagi SKU: `Mahsulot — Variant [A-001]` */
export function extractSkuFromSnapshot(snapshot?: string | null): string | null {
  const m = String(snapshot || '')
    .trim()
    .match(/\[\s*([^\]]+?)\s*\]\s*$/);
  return m ? m[1].trim() : null;
}

/** API ga saqlanadigan snapshot: "Mahsulot — Variant [SKU]" */
export function buildOrderProductSnapshot(
  productName: string,
  variantLabel?: string,
  skuCode?: string | null,
): string {
  const p = String(productName || '').trim();
  const v = cleanRedundantParens(String(variantLabel || '').trim());
  const code = String(skuCode || '').trim();
  let base = '';
  if (!p) base = v;
  else if (!v) base = p;
  else if (p.toLowerCase() === v.toLowerCase()) base = p;
  else base = `${p} — ${v}`;
  if (!base) return code ? `[${code}]` : '';
  return code ? `${base} [${code}]` : base;
}

/** "Qora (Qora)" → "Qora" */
export function cleanRedundantParens(text: string): string {
  const t = String(text || '').trim();
  const m = t.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (!m) return t;
  const outer = m[1].trim();
  const inner = m[2].trim();
  if (outer.toLowerCase() === inner.toLowerCase()) return outer;
  return t;
}

/** Ekranda ko‘rsatish — mavjud snapshotlarni ham tozalaydi */
/** B2B buyurtma / jo‘natma qatori — snapshot yoki variantdan sarlavha + SKU */
export function displayB2BOrderLineItem(item: {
  productNameSnapshot?: string | null;
  productVariant?: {
    name?: string | null;
    sku?: string | null;
    barcode?: string | null;
    product?: { name?: string | null } | null;
    attributesJson?: Record<string, unknown> | null;
  } | null;
}): { title: string; sku: string } {
  const snap = String(item.productNameSnapshot || '').trim();
  if (snap) {
    const sku =
      item.productVariant?.sku?.trim() ||
      item.productVariant?.barcode?.trim() ||
      '';
    return { title: displayOrderProductSnapshot(snap), sku };
  }
  const v = item.productVariant;
  if (v?.product?.name || v?.name) {
    return {
      title: formatOwnVariantPickerLabel(v.product?.name || 'Mahsulot', v),
      sku: v.sku?.trim() || v.barcode?.trim() || '',
    };
  }
  return { title: 'Mahsulot', sku: '' };
}

export function displayOrderProductSnapshot(snapshot?: string | null): string {
  const s = String(snapshot || '').trim();
  if (!s) return 'Mahsulot';
  const parts = s.split(DASH_SPLIT);
  if (parts.length < 2) return cleanRedundantParens(s);
  const head = parts[0].trim();
  const tail = cleanRedundantParens(parts.slice(1).join(' — '));
  return tail ? `${head} — ${tail}` : head;
}

/** Mapping / qidiruv: `A-001 — Qora (Qora)` va `A-001 — Qora` bir xil */
/** Mapping / tanlov: SKU bo‘lmasa variant nomi + rang */
export function formatOwnVariantPickerLabel(
  productName: string,
  variant: {
    name?: string | null;
    sku?: string | null;
    barcode?: string | null;
    attributesJson?: Record<string, unknown> | null;
  },
): string {
  const p = String(productName || '').trim() || 'Mahsulot';
  const attrs = (variant.attributesJson || {}) as Record<string, unknown>;
  const color = String(attrs.color ?? attrs.Color ?? '').trim();
  const variantLabel = formatVariantLabel(String(variant.name || '').trim() || 'Variant', color);
  const code = String(variant.sku ?? '').trim() || String(variant.barcode ?? '').trim();
  return code ? `${p} — ${variantLabel} [${code}]` : `${p} — ${variantLabel}`;
}

export function normalizePartnerProductName(name?: string | null): string {
  return cleanRedundantParens(String(name || '').trim())
    .replace(/\s*[-–—]\s*/g, ' — ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function stripTrailingSkuBracket(snapshot: string): string {
  return String(snapshot || '')
    .trim()
    .replace(/\s*\[[^\]]+\]\s*$/, '')
    .trim();
}

export function splitSnapshotToLine(snapshot: string): {
  productName: string;
  variantLabel: string;
} {
  const parts = stripTrailingSkuBracket(snapshot).split(DASH_SPLIT);
  if (parts.length < 2) {
    return { productName: parts[0] || '', variantLabel: '' };
  }
  return {
    productName: parts[0].trim(),
    variantLabel: cleanRedundantParens(parts.slice(1).join(' — ')),
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Mappingdagi partnerSku ba'zan sotuvchi variant UUID (ichki kalit) */
export function isPartnerSkuInternalId(value?: string | null): boolean {
  return UUID_RE.test(String(value || '').trim());
}

function looksLikeProductCode(value?: string | null): boolean {
  const t = String(value || '').trim();
  if (!t || t.length > 48 || /\s/.test(t)) return false;
  return (
    /^[A-Za-z]{1,6}-[\dA-Za-z][\dA-Za-z-]*$/.test(t) ||
    /^[A-Z]{0,4}\d{2,10}$/i.test(t)
  );
}

/** `M-524 — Tilla` yoki `Mahsulot [A-001]` dan artikul */
function inferSkuFromPartnerProductName(name?: string | null): string | null {
  const fromBracket = extractSkuFromSnapshot(name);
  if (fromBracket && !isPartnerSkuInternalId(fromBracket)) return fromBracket;

  const snap = String(name || '').trim();
  if (!snap) return null;

  const { productName } = splitSnapshotToLine(snap);
  if (looksLikeProductCode(productName)) return productName;

  if (looksLikeProductCode(snap)) return snap;

  return null;
}

/** Jadval / forma uchun o‘qiladigan artikul (M-524) */
export function displayPartnerMappingSku(mapping: {
  partnerSku?: string | null;
  partnerBarcode?: string | null;
  partnerProductName?: string | null;
}): string {
  const barcode = mapping.partnerBarcode?.trim();
  if (barcode && !isPartnerSkuInternalId(barcode)) return barcode;

  const sku = mapping.partnerSku?.trim();
  if (sku && !isPartnerSkuInternalId(sku)) return sku;

  const inferred = inferSkuFromPartnerProductName(mapping.partnerProductName);
  if (inferred) return inferred;

  return '—';
}

export function editablePartnerMappingSku(mapping: {
  partnerSku?: string | null;
  partnerBarcode?: string | null;
  partnerProductName?: string | null;
}): string {
  const shown = displayPartnerMappingSku(mapping);
  return shown === '—' ? '' : shown;
}
