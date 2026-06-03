import type { SaleCurrency } from '@/lib/currency';

export interface PosCartItem {
  variantId: string;
  productId: string;
  name: string;
  variantName: string;
  listPrice: number;
  price: number;
  currency: SaleCurrency;
  quantity: number;
  image?: string;
}
