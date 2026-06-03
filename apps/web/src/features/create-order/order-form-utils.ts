export type Currency = 'UZS' | 'USD';

export interface FormItem {
  productName: string;
  /** Faqat «Hamkor katalogi» dan — sotuvchi variant ID (API ga yuboriladi) */
  sellerProductVariantId: string;
  /** Qo'lda: o'z katalogingizdan rang/nom (faqat matn, API variant ID emas) */
  variantId: string;
  variantLabel: string;
  /** Sotuvchi katalog SKU — snapshot `[kod]` uchun */
  variantSku?: string;
  quantity: number;
  price: string;
  currency: Currency;
  snapshotName?: string;
  snapshotVariant?: string;
}

export interface FormState {
  partnerId: string;
  deliveryDate: string;
  notes: string;
  items: FormItem[];
}

export const defaultFormItem = (): FormItem => ({
  productName: '',
  sellerProductVariantId: '',
  variantId: '',
  variantLabel: '',
  quantity: 1,
  price: '',
  currency: 'UZS',
});

export function snapshotFromLine(item: FormItem): string {
  return item.snapshotName || item.productName || '';
}

export {
  buildOrderProductSnapshot,
  displayOrderProductSnapshot,
  formatVariantLabel,
  splitSnapshotToLine,
} from '@/lib/order-product-label';

export const emptyFormState = (): FormState => ({
  partnerId: '',
  deliveryDate: new Date().toISOString().split('T')[0],
  notes: '',
  items: [defaultFormItem()],
});

export function formatAmount(value: number, currency: Currency): string {
  const amount = Number(value || 0);
  if (currency === 'USD') {
    return `$${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
  }
  return `${Math.round(amount).toLocaleString('uz-UZ')} UZS`;
}

export function getOrderTotal(items: FormItem[]): { uzs: number; usd: number } {
  return items.reduce(
    (acc, item) => {
      const price = parseFloat(item.price) || 0;
      const qty = item.quantity || 0;
      if (item.currency === 'USD') acc.usd += price * qty;
      else acc.uzs += price * qty;
      return acc;
    },
    { uzs: 0, usd: 0 },
  );
}

export function getMatchedVariants(
  products: any[],
  query: string,
): Array<{
  variantId: string;
  label: string;
  productName: string;
  salePrice?: number;
  currency?: string;
}> {
  if (!query || query.length < 1) return [];
  const q = query.toLowerCase();
  const results: Array<{
    variantId: string;
    label: string;
    productName: string;
    salePrice?: number;
    currency?: string;
  }> = [];
  for (const product of products || []) {
    const nameMatch = product.name?.toLowerCase().includes(q);
    for (const variant of product.variants || []) {
      const variantLabel = variant.name || '';
      const variantMatch = variantLabel.toLowerCase().includes(q);
      if (nameMatch || variantMatch) {
        results.push({
          variantId: variant.id,
          label: variantLabel ? `${product.name} — ${variantLabel}` : product.name,
          productName: product.name,
          salePrice: variant.salePrice,
          currency: variant.currency || 'UZS',
        });
      }
    }
    if ((product.variants || []).length === 0 && nameMatch) {
      results.push({
        variantId: '',
        label: product.name,
        productName: product.name,
      });
    }
  }
  return results.slice(0, 12);
}
