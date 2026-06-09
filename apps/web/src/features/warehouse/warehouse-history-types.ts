export type StockHistoryUser = {
  id: string;
  fullName: string;
};

export type StockIntakeHistoryLine = {
  id: string;
  productName: string;
  variantName: string;
  quantity: number;
  barcode?: string | null;
  sku?: string | null;
};

export type StockIntakeHistoryItem = {
  kind: 'intake';
  id: string;
  intakeId: string;
  reference: string;
  createdAt: string;
  type: 'IN';
  sourceType: 'WAREHOUSE_INTAKE';
  sourceLabel: string;
  createdBy: StockHistoryUser | null;
  warehouse?: { id: string; name: string };
  totalUnits: number;
  lineCount: number;
  note?: string | null;
  lines: StockIntakeHistoryLine[];
};

export type StockSingleHistoryItem = {
  kind: 'single';
  id: string;
  createdAt: string;
  type: string;
  sourceType?: string | null;
  sourceLabel: string;
  createdBy: StockHistoryUser | null;
  warehouse?: { id: string; name: string };
  productVariant: {
    id: string;
    name: string;
    product: { id: string; name: string };
  };
  quantity: number;
  note?: string | null;
};

export type StockHistoryItem = StockIntakeHistoryItem | StockSingleHistoryItem;

export function isIntakeHistoryItem(
  item: StockHistoryItem,
): item is StockIntakeHistoryItem {
  return item.kind === 'intake';
}
