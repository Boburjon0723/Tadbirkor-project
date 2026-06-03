/** B2B buyurtma invoice / Excel — mahsulot qatorlarini birlashtirish */

export type AggregatedOrderRow = {
  code: string;
  productName: string;
  variantName: string;
  qty: number;
  price: number;
  currency: string;
  lineTotal: number;
};

const SNAPSHOT_DASH = /\s+[-–—]\s+/;

function parseSnapshotDash(
  snapshot: string,
): { left: string; right: string } | null {
  const parts = String(snapshot).trim().split(SNAPSHOT_DASH);
  if (parts.length < 2) return null;
  return { left: parts[0].trim(), right: parts.slice(1).join(' — ').trim() };
}

function looksLikeProductCode(s: string): boolean {
  const t = s.trim();
  if (!t || t.length > 64 || /\s/.test(t)) return false;
  if (/^[A-Za-z]{1,8}-\d+[A-Za-z0-9_-]*$/.test(t)) return true;
  if (/^\d+[A-Za-z0-9_-]*-[A-Za-z0-9_-]+$/.test(t)) return true;
  if (/^[A-Z0-9][A-Z0-9._-]{1,}$/i.test(t) && /[0-9]/.test(t)) return true;
  return false;
}

function displayCode(item: {
  productVariant?: { sku?: string | null; barcode?: string | null } | null;
  productNameSnapshot?: string | null;
}): string {
  const v = item?.productVariant;
  const sku = String(v?.sku ?? '').trim();
  const barcode = String(v?.barcode ?? '').trim();
  if (sku) return sku;
  if (barcode) return barcode;
  const snap = String(item?.productNameSnapshot ?? '').trim();
  const parsed = parseSnapshotDash(snap);
  if (parsed && looksLikeProductCode(parsed.left)) return parsed.left;
  return '—';
}

function productAndVariant(item: {
  productVariant?: {
    name?: string | null;
    product?: { name?: string | null } | null;
  } | null;
  productNameSnapshot?: string | null;
}) {
  const v = item?.productVariant;
  const fromProduct = String(v?.product?.name ?? '').trim();
  const fromVariant = String(v?.name ?? '').trim();
  const snapshot = String(item?.productNameSnapshot ?? '').trim();
  const parsed = parseSnapshotDash(snapshot);

  if (parsed && looksLikeProductCode(parsed.left)) {
    return {
      productName: fromProduct || parsed.left || '—',
      variantName: fromVariant || parsed.right || '—',
    };
  }
  if (parsed) {
    return {
      productName: fromProduct || parsed.left || '—',
      variantName: fromVariant || parsed.right || '—',
    };
  }
  return {
    productName: fromProduct || snapshot || 'Mahsulot',
    variantName: fromVariant.length > 0 ? fromVariant : '—',
  };
}

function mergeKey(item: {
  productVariant?: {
    sku?: string | null;
    barcode?: string | null;
    name?: string | null;
    product?: { name?: string | null } | null;
  } | null;
  productNameSnapshot?: string | null;
  expectedPrice?: unknown;
  expectedCurrency?: string | null;
}): string {
  const { productName, variantName } = productAndVariant(item);
  const code = displayCode(item);
  const price = Number(item.expectedPrice || 0);
  const currency = String(item.expectedCurrency || 'UZS');
  return [
    `code:${code.toUpperCase()}`,
    `product:${productName.toUpperCase()}`,
    `variant:${variantName.toUpperCase()}`,
    `price:${price}`,
    `currency:${currency.toUpperCase()}`,
  ].join('|');
}

export function aggregateOrderItems(
  items: Array<{
    productVariant?: {
      sku?: string | null;
      barcode?: string | null;
      name?: string | null;
      product?: { name?: string | null } | null;
    } | null;
    productNameSnapshot?: string | null;
    quantity?: unknown;
    expectedPrice?: unknown;
    expectedCurrency?: string | null;
  }>,
): AggregatedOrderRow[] {
  const aggregated = new Map<string, AggregatedOrderRow>();

  for (const item of items || []) {
    const key = mergeKey(item);
    const code = displayCode(item);
    const { productName, variantName } = productAndVariant(item);
    const qty = Number(item.quantity || 0);
    const price = Number(item.expectedPrice || 0);
    const currency = String(item.expectedCurrency || 'UZS');

    const prev = aggregated.get(key);
    if (prev) {
      prev.qty += qty;
      prev.lineTotal = prev.qty * prev.price;
    } else {
      aggregated.set(key, {
        code,
        productName,
        variantName,
        qty,
        price,
        currency,
        lineTotal: qty * price,
      });
    }
  }

  return Array.from(aggregated.values());
}
