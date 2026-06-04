import type { LucideIcon } from 'lucide-react';
import { Box, Truck, ClipboardList, Layers } from 'lucide-react';

export type WarehouseFeatureBundle = {
  id: string;
  name: string;
  desc: string;
  icon: LucideIcon;
  featureKeys: string[];
  requiresBundleIds?: string[];
  includesLabel: string;
};

/** Sozlamalar → Modullar → Ombor: guruhlangan bo‘limlar */
export const WAREHOUSE_FEATURE_BUNDLES: WarehouseFeatureBundle[] = [
  {
    id: 'core',
    name: 'Asosiy ombor',
    desc: 'Katalog, qoldiq, kirim/chiqim va tuzatish',
    icon: Box,
    featureKeys: ['WAREHOUSE_BASIC', 'STOCK_ADJUSTMENT'],
    includesLabel: 'Mahsulotlar, qoldiq, harakatlar',
  },
  {
    id: 'b2b_outbound',
    name: 'Chiqim zanjiri (picking + ATP)',
    desc: 'Rezerv va saralash — B2B jo‘natma oqimi',
    icon: Truck,
    featureKeys: ['WAREHOUSE_PICKING', 'WAREHOUSE_ATP'],
    requiresBundleIds: ['core'],
    includesLabel: 'Saralash + zaxira holati (ATP)',
  },
  {
    id: 'inventory_count',
    name: 'Inventarizatsiya',
    desc: 'Sanash va farqlarni tasdiqlash',
    icon: ClipboardList,
    featureKeys: ['WAREHOUSE_INVENTORY_COUNT'],
    requiresBundleIds: ['core'],
    includesLabel: 'Inventarizatsiya sahifasi',
  },
];

export const WAREHOUSE_BUNDLE_ALL_ID = 'all';

export const WAREHOUSE_ALL_BUNDLE_LABEL = {
  name: 'Barcha ombor bo‘limlari',
  desc: 'Yuqoridagi uchala guruhni birdaniga yoqish yoki o‘chirish',
  icon: Layers,
};

/** @deprecated alohida toggle — endi faqat bundle */
export const WAREHOUSE_SECTION_FEATURES = WAREHOUSE_FEATURE_BUNDLES.flatMap((b) =>
  b.featureKeys.map((key) => ({ key, name: b.name, desc: b.desc })),
);
