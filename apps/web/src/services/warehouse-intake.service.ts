import { api } from '@/lib/api';

export type IntakeScanMode = 'SINGLE_SCAN_QTY' | 'EACH_SCAN_ONE';

export type WarehouseIntakeSettings = {
  scanMode: IntakeScanMode;
  allowBulkQty: boolean;
  allowQuickProduct: boolean;
  maxQtyPerScan: number | null;
};

export type IntakeLine = {
  id: string;
  productVariantId: string;
  quantity: number | string;
  scanCount: number;
  scannedBarcode?: string | null;
  entryMode: 'MANUAL' | 'SCAN';
  productVariant: {
    id: string;
    name: string;
    sku?: string | null;
    barcode?: string | null;
    product?: {
      id: string;
      name: string;
      unit?: string;
      imageUrl?: string | null;
    };
  };
};

export type WarehouseIntake = {
  id: string;
  reference: string;
  status: 'DRAFT' | 'COMPLETED' | 'CANCELLED';
  warehouseId: string;
  note?: string | null;
  partnerLedgerContactId?: string | null;
  createdAt: string;
  completedAt?: string | null;
  warehouse?: { id: string; name: string };
  lines: IntakeLine[];
  intakeSettings?: WarehouseIntakeSettings;
  _count?: { lines: number };
};

export type IntakeLookupResult =
  | {
      found: true;
      productVariantId: string;
      name: string;
      sku?: string | null;
      barcode?: string | null;
      product?: IntakeLine['productVariant']['product'];
      intakeSettings: WarehouseIntakeSettings;
    }
  | {
      found: false;
      barcode: string;
      allowQuickProduct: boolean;
      intakeSettings: WarehouseIntakeSettings;
    };

export const warehouseIntakeService = {
  list(params?: { status?: string; warehouseId?: string }) {
    return api
      .get<WarehouseIntake[]>('/warehouse-intake', { params })
      .then((r) => r.data);
  },

  getOne(id: string) {
    return api.get<WarehouseIntake>(`/warehouse-intake/${id}`).then((r) => r.data);
  },

  create(dto: {
    warehouseId: string;
    note?: string;
    partnerLedgerContactId?: string;
  }) {
    return api.post<WarehouseIntake>('/warehouse-intake', dto).then((r) => r.data);
  },

  lookup(barcode: string, warehouseId?: string) {
    return api
      .get<IntakeLookupResult>('/warehouse-intake/lookup', {
        params: { barcode, warehouseId },
      })
      .then((r) => r.data);
  },

  scan(intakeId: string, dto: { barcode: string; quantity?: number }) {
    return api
      .post<WarehouseIntake>(`/warehouse-intake/${intakeId}/scan`, dto)
      .then((r) => r.data);
  },

  quickProduct(
    intakeId: string,
    dto: {
      barcode: string;
      name: string;
      quantity?: number;
      salePrice?: number;
      purchasePrice?: number;
      categoryId?: string;
      unit?: string;
    },
  ) {
    return api
      .post<WarehouseIntake>(`/warehouse-intake/${intakeId}/quick-product`, dto)
      .then((r) => r.data);
  },

  addLine(intakeId: string, dto: { productVariantId: string; quantity: number }) {
    return api
      .post<WarehouseIntake>(`/warehouse-intake/${intakeId}/lines`, dto)
      .then((r) => r.data);
  },

  updateLine(intakeId: string, lineId: string, quantity: number) {
    return api
      .patch<WarehouseIntake>(`/warehouse-intake/${intakeId}/lines/${lineId}`, {
        quantity,
      })
      .then((r) => r.data);
  },

  removeLine(intakeId: string, lineId: string) {
    return api
      .delete<WarehouseIntake>(`/warehouse-intake/${intakeId}/lines/${lineId}`)
      .then((r) => r.data);
  },

  complete(intakeId: string) {
    return api
      .post<WarehouseIntake>(`/warehouse-intake/${intakeId}/complete`)
      .then((r) => r.data);
  },

  cancel(intakeId: string) {
    return api
      .post<WarehouseIntake>(`/warehouse-intake/${intakeId}/cancel`)
      .then((r) => r.data);
  },

  getIntakeSettings(warehouseId?: string) {
    return api
      .get<{ settings: WarehouseIntakeSettings; warehouseId: string | null }>(
        '/companies/intake-settings',
        { params: warehouseId ? { warehouseId } : undefined },
      )
      .then((r) => r.data);
  },

  updateIntakeSettings(patch: Partial<WarehouseIntakeSettings>) {
    return api
      .patch<{ settings: WarehouseIntakeSettings }>('/companies/intake-settings', patch)
      .then((r) => r.data);
  },
};
