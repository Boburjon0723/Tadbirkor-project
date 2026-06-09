import type { SaleCurrency } from '@/lib/currency';
import type { ProductUnitCode } from '@/lib/product-units';

export interface PosCartItem {
  variantId: string;
  productId: string;
  name: string;
  variantName: string;
  listPrice: number;
  price: number;
  currency: SaleCurrency;
  unit: ProductUnitCode;
  quantity: number;
  stockQuantity?: number;
  image?: string;
}
