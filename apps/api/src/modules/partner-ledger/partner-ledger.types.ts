export const PARTNER_LEDGER_OPERATION_TYPES = [
  'MATERIAL_IN',
  'SALE_OUT',
  'RECEIPT_FROM_PARTNER',
  'PAYMENT_TO_PARTNER',
] as const;

export type PartnerLedgerOperationType = (typeof PARTNER_LEDGER_OPERATION_TYPES)[number];

/** Balans: musbat = ular bizga qarz; manfiy = biz ularga qarz */
export function balanceDeltaForType(type: string, amount: number): number {
  const n = Math.abs(amount);
  switch (type) {
    case 'MATERIAL_IN':
      return -n;
    case 'SALE_OUT':
      return n;
    case 'RECEIPT_FROM_PARTNER':
      return -n;
    case 'PAYMENT_TO_PARTNER':
      return n;
    default:
      return 0;
  }
}

export const OPERATION_TYPE_LABELS: Record<PartnerLedgerOperationType, string> = {
  MATERIAL_IN: 'Kirim (xomashyo)',
  SALE_OUT: 'Sotish / chiqim',
  RECEIPT_FROM_PARTNER: 'Hamkordan tushum',
  PAYMENT_TO_PARTNER: 'Hamkorga to‘lov',
};
