import type { PosCustomerSelection } from './PosCustomerStrip';
import type { CartSession } from './usePosMultiCart';

export function hasPosCustomer(customer: PosCustomerSelection): boolean {
  return !!customer.retailCustomerId || !!customer.customerName?.trim();
}

/** UI da ko'rsatish uchun qisqa mijoz nomi */
export function getPosCustomerLabel(customer: PosCustomerSelection): string {
  if (customer.customerName?.trim()) return customer.customerName.trim();
  if (customer.retailCustomerId) return 'Tanlangan';
  return '';
}

export function getSessionCustomerSubtitle(session: CartSession): string | null {
  const label = getPosCustomerLabel(session.customer);
  return label || null;
}
