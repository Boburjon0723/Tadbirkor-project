import { parseSnapshotParts } from '../../common/product-code.util';

/** Prisma.Decimal / string / number → barqaror son (Number(decimal) ba'zan NaN beradi). */
export function toFiniteMoney(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number(value.trim().replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === 'object') {
    const o = value as { toNumber?: () => number; toString?: () => string };
    if (typeof o.toNumber === 'function') {
      const n = o.toNumber();
      return Number.isFinite(n) ? n : 0;
    }
    if (typeof o.toString === 'function') {
      const n = Number(String(o.toString()).trim().replace(/\s/g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    }
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function getOwnVariantIdFromMapping(mapping: {
  ownProductVariantId?: string | null;
  ownProductVariant?: { id?: string | null } | null;
} | null | undefined): string | null {
  if (!mapping) return null;
  return mapping.ownProductVariantId || mapping.ownProductVariant?.id || null;
}

export function parseReceiptSnapshot(snapshot: string): { baseName: string; variantLabel: string } {
  const { productName, variantName } = parseSnapshotParts(snapshot);
  return {
    baseName: productName,
    variantLabel: variantName === 'Standart' ? '' : variantName,
  };
}

export function receiptStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'Kutilmoqda';
    case 'ACCEPTED':
      return 'Qabul qilingan';
    case 'PARTIALLY_ACCEPTED':
      return 'Qisman qabul';
    case 'REJECTED':
      return 'Rad etilgan';
    default:
      return status;
  }
}
