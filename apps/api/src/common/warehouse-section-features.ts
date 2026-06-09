/** Ombor moduli ichidagi SAP uslubidagi bo‘limlar (feature kalitlari) */
export const WAREHOUSE_SECTION_FEATURE_KEYS = [
  'WAREHOUSE_BASIC',
  'STOCK_ADJUSTMENT',
  'WAREHOUSE_PICKING',
  'WAREHOUSE_ATP',
  'WAREHOUSE_INVENTORY_COUNT',
  'WAREHOUSE_INTAKE',
] as const;

export type WarehouseSectionFeatureKey =
  (typeof WAREHOUSE_SECTION_FEATURE_KEYS)[number];

export const WAREHOUSE_SECTION_FEATURE_DEFS: {
  key: WarehouseSectionFeatureKey;
  name: string;
  description: string;
}[] = [
  {
    key: 'WAREHOUSE_BASIC',
    name: 'Mahsulotlar va qoldiq',
    description: 'Katalog ko‘rish, qoldiq, kirim/chiqim (asosiy ombor).',
  },
  {
    key: 'STOCK_ADJUSTMENT',
    name: 'Qoldiq tuzatish',
    description: 'Qo‘lda tuzatish va ombor harakatlari.',
  },
  {
    key: 'WAREHOUSE_PICKING',
    name: 'Saralash (picking)',
    description: 'Jo‘natma bo‘yicha yig‘ish, skaner, PGI oldidan saralash.',
  },
  {
    key: 'WAREHOUSE_ATP',
    name: 'Zaxira holati (ATP)',
    description: 'Rezerv, erkin qoldiq, ATP ko‘rinishi.',
  },
  {
    key: 'WAREHOUSE_INVENTORY_COUNT',
    name: 'Inventarizatsiya',
    description: 'Sanash, farq, tasdiqlash va ombor bloklari.',
  },
  {
    key: 'WAREHOUSE_INTAKE',
    name: 'Ombor kirimi',
    description: 'Qo‘lda va skaner orqali mahsulot kirimi (hujjat asosida).',
  },
];

/** Bog‘liq bo‘limlar — bitta nom, bitta tugma */
export const WAREHOUSE_FEATURE_BUNDLES: {
  id: string;
  name: string;
  description: string;
  featureKeys: WarehouseSectionFeatureKey[];
  /** Yoqilganda avval shu guruhlar ham yoqiladi */
  requiresBundleIds?: string[];
}[] = [
  {
    id: 'core',
    name: 'Asosiy ombor',
    description:
      'Mahsulotlar, qoldiq, kirim/chiqim va qo‘lda tuzatish — boshqa bo‘limlar uchun asos.',
    featureKeys: ['WAREHOUSE_BASIC', 'STOCK_ADJUSTMENT', 'WAREHOUSE_INTAKE'],
  },
  {
    id: 'b2b_outbound',
    name: 'Chiqim zanjiri (picking + ATP)',
    description:
      'Buyurtma rezervi (ATP), saralash va jo‘natma yig‘ish — B2B chiqim oqimi.',
    featureKeys: ['WAREHOUSE_PICKING', 'WAREHOUSE_ATP'],
    requiresBundleIds: ['core'],
  },
  {
    id: 'inventory_count',
    name: 'Inventarizatsiya',
    description: 'Ombor sanash, farq va tasdiqlash.',
    featureKeys: ['WAREHOUSE_INVENTORY_COUNT'],
    requiresBundleIds: ['core'],
  },
];

export const WAREHOUSE_BUNDLE_ALL_ID = 'all';
