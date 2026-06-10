export type PosCustomerSelection = {
  retailCustomerId?: string;
  customerName?: string;
  customerPhone?: string;
};

export function hasPosCustomer(customer?: PosCustomerSelection | null): boolean {
  if (!customer) return false;
  return !!customer.retailCustomerId || !!customer.customerName?.trim();
}

export function getPosCustomerLabel(customer?: PosCustomerSelection | null): string {
  if (!customer) return '';
  if (customer.customerName?.trim()) return customer.customerName.trim();
  if (customer.retailCustomerId) return 'Tanlangan';
  return '';
}
