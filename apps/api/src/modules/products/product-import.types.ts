import type { ImportLedgerAccumulator } from './product-import-ledger.util';

export type ProductImportMode = 'set' | 'add' | 'subtract';
export type ProductImportStockPolicy = 'skip_zero_and_unchanged' | 'apply_all';
export type ProductImportFileStockMode = 'with_stock' | 'without_stock';

export type ProductImportOptions = {
  importMode: ProductImportMode;
  stockPolicy: ProductImportStockPolicy;
  partnerLedgerContactId?: string;
  ledgerSourceId?: string;
};

export type CategoryPathResolver = {
  resolveOrCreate: (
    tx: import('@prisma/client').Prisma.TransactionClient,
    companyId: string,
    warehouseId: string,
    categoryRaw: string,
    cache: Map<string, string>,
  ) => Promise<string | undefined>;
};

export type ImportProductSnapshot = {
  id: string;
  name: string;
  unit: string;
  categoryId: string | null;
  status: string;
};

export type ImportVariantSnapshot = {
  id: string;
  productId: string;
  status: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  purchasePrice: import('@prisma/client/runtime/library').Decimal | null;
  salePrice: import('@prisma/client/runtime/library').Decimal | null;
  currency: string;
  attributesJson: import('@prisma/client').Prisma.JsonValue | null;
  product: ImportProductSnapshot | null;
  stockByWarehouse: Map<string, number>;
  isArchived: boolean;
};

export type ImportExecuteLookup = {
  variantById: Map<string, ImportVariantSnapshot>;
  variantBySku: Map<string, ImportVariantSnapshot>;
  variantByBarcode: Map<string, ImportVariantSnapshot>;
  archivedBySku: Map<string, ImportVariantSnapshot>;
  archivedByBarcode: Map<string, ImportVariantSnapshot>;
  productById: Map<string, ImportProductSnapshot>;
  productByName: Map<string, ImportProductSnapshot>;
};

export type ImportRowProcessContext = {
  options: ProductImportOptions;
  seenBarcode: Set<string>;
  seenSkuInImport: Set<string>;
  skuProductCache: Map<string, string>;
  categoryCache: Map<string, string>;
  activeWarehouseSet: Set<string>;
  categoryResolver: CategoryPathResolver;
  ledgerAcc: ImportLedgerAccumulator | null;
  lookup: ImportExecuteLookup;
};
