export type IntakeScanMode = 'SINGLE_SCAN_QTY' | 'EACH_SCAN_ONE';

export interface WarehouseIntakeSettings {
  /** Tez: 1 skaner + miqdor; Qattiq: har skaner +1 */
  scanMode: IntakeScanMode;
  /** SINGLE_SCAN_QTY rejimida skanersiz / qo'lda miqdor kiritish */
  allowBulkQty: boolean;
  /** Noma'lum barcode → yangi mahsulot yaratish */
  allowQuickProduct: boolean;
  /** Bir skaner/qator uchun maks. miqdor (null = cheksiz) */
  maxQtyPerScan: number | null;
}

export const DEFAULT_WAREHOUSE_INTAKE_SETTINGS: WarehouseIntakeSettings = {
  scanMode: 'SINGLE_SCAN_QTY',
  allowBulkQty: true,
  allowQuickProduct: false,
  maxQtyPerScan: null,
};

function parseScanMode(value: unknown): IntakeScanMode {
  const v = String(value || '').trim().toUpperCase();
  if (v === 'EACH_SCAN_ONE') return 'EACH_SCAN_ONE';
  return 'SINGLE_SCAN_QTY';
}

function parseMaxQty(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

export function normalizeIntakeSettings(
  raw?: Partial<WarehouseIntakeSettings> | null,
): WarehouseIntakeSettings {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_WAREHOUSE_INTAKE_SETTINGS };
  }
  return {
    scanMode: parseScanMode(raw.scanMode),
    allowBulkQty:
      raw.allowBulkQty !== undefined
        ? Boolean(raw.allowBulkQty)
        : DEFAULT_WAREHOUSE_INTAKE_SETTINGS.allowBulkQty,
    allowQuickProduct:
      raw.allowQuickProduct !== undefined
        ? Boolean(raw.allowQuickProduct)
        : DEFAULT_WAREHOUSE_INTAKE_SETTINGS.allowQuickProduct,
    maxQtyPerScan:
      raw.maxQtyPerScan !== undefined
        ? parseMaxQty(raw.maxQtyPerScan)
        : DEFAULT_WAREHOUSE_INTAKE_SETTINGS.maxQtyPerScan,
  };
}

/** Ombor fieldConfig.intakeSettings kompaniya sozlamasini override qiladi */
export function resolveWarehouseIntakeSettings(
  companyRaw?: unknown,
  warehouseFieldConfig?: unknown,
): WarehouseIntakeSettings {
  const company = normalizeIntakeSettings(
    companyRaw as Partial<WarehouseIntakeSettings> | null,
  );
  const fc =
    warehouseFieldConfig &&
    typeof warehouseFieldConfig === 'object' &&
    !Array.isArray(warehouseFieldConfig)
      ? (warehouseFieldConfig as Record<string, unknown>)
      : null;
  const warehouseOverride = fc?.intakeSettings ?? fc?.intake;
  if (!warehouseOverride) return company;
  return normalizeIntakeSettings({
    ...company,
    ...(warehouseOverride as Partial<WarehouseIntakeSettings>),
  });
}

export function mergeIntakeSettingsPatch(
  current: WarehouseIntakeSettings,
  patch: Partial<WarehouseIntakeSettings>,
): WarehouseIntakeSettings {
  return normalizeIntakeSettings({ ...current, ...patch });
}

export type IntakeQuantityContext = 'SCAN' | 'MANUAL' | 'UPDATE';

/** Skaner / qo'lda miqdor qoidalari */
export function assertIntakeQuantityAllowed(
  settings: WarehouseIntakeSettings,
  context: IntakeQuantityContext,
  quantity: number,
  options?: { existingQty?: number; scanIncrement?: number },
): number {
  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error('Miqdor noto‘g‘ri');
  }

  if (settings.scanMode === 'EACH_SCAN_ONE') {
    if (context === 'UPDATE') {
      throw new Error(
        'Qattiq rejim: miqdorni qo‘lda o‘zgartirish mumkin emas. Har donani skanerlang yoki qatorni o‘chiring.',
      );
    }
    if (context === 'MANUAL') {
      throw new Error(
        'Qattiq rejim: qo‘lda qator qo‘shish o‘chirilgan. Faqat skaner ishlating.',
      );
    }
    if (context === 'SCAN') {
      const inc = options?.scanIncrement ?? 1;
      if (inc !== 1 || qty !== 1) {
        throw new Error('Qattiq rejim: har skaner faqat 1 dona qo‘shadi');
      }
      return 1;
    }
  }

  // SINGLE_SCAN_QTY
  if (context === 'SCAN' && !settings.allowBulkQty) {
    if (qty !== 1) {
      throw new Error(
        'Sozlamalar: bir skanerda faqat 1 dona. Ko‘proq miqdor uchun har donani skanerlang.',
      );
    }
    return 1;
  }

  if (context === 'MANUAL' && !settings.allowBulkQty) {
    throw new Error(
      'Sozlamalar: qo‘lda miqdor kiritish o‘chirilgan. Skaner ishlating.',
    );
  }

  if (settings.maxQtyPerScan != null && qty > settings.maxQtyPerScan) {
    throw new Error(
      `Bir amalda maksimum ${settings.maxQtyPerScan} dona (sozlama limiti).`,
    );
  }

  if (
    context === 'UPDATE' &&
    settings.maxQtyPerScan != null &&
    qty > settings.maxQtyPerScan
  ) {
    throw new Error(
      `Qator miqdori maksimum ${settings.maxQtyPerScan} dan oshmasligi kerak.`,
    );
  }

  return qty;
}

/** Qator jami miqdori limiti (takroriy skaner bilan aylanib o‘tishni oldini oladi) */
export function assertIntakeLineTotalAllowed(
  settings: WarehouseIntakeSettings,
  existingQty: number,
  addQty: number,
): void {
  if (settings.maxQtyPerScan == null) return;
  const total = Number(existingQty) + Number(addQty);
  if (!Number.isFinite(total) || total > settings.maxQtyPerScan) {
    throw new Error(
      `Qator jami miqdori ${settings.maxQtyPerScan} dan oshmasligi kerak (hozir ${existingQty}, qo‘shilmoqda ${addQty}).`,
    );
  }
}

export const INTAKE_STATUSES = ['DRAFT', 'COMPLETED', 'CANCELLED'] as const;
export type IntakeStatus = (typeof INTAKE_STATUSES)[number];

export function parseIntakeStatus(raw?: string): IntakeStatus | undefined {
  const v = String(raw || '').trim().toUpperCase();
  if (!v) return undefined;
  return (INTAKE_STATUSES as readonly string[]).includes(v)
    ? (v as IntakeStatus)
    : undefined;
}
