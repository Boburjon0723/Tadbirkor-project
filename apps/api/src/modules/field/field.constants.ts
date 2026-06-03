export const FIELD_TASK_STATUS = {
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  REPORTED: 'REPORTED',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
  NEEDS_FIX: 'NEEDS_FIX',
  CANCELED: 'CANCELED',
} as const;

export const FIELD_STOCK_SOURCE = {
  FIELD_ASSIGN: 'FIELD_ASSIGN',
  WORKER_TO_CUSTOMER: 'WORKER_TO_CUSTOMER',
  WORKER_RETURN: 'WORKER_RETURN',
  WORKER_LOSS: 'WORKER_LOSS',
} as const;

export type PlannedItem = {
  variantId: string;
  qty: number;
  label?: string;
};

export type ReportItem = {
  variantId: string;
  usedQty: number;
  returnedQty: number;
  lostQty: number;
};
