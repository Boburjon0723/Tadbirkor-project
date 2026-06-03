import {
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  Warehouse as WarehouseIcon,
  type LucideIcon,
} from 'lucide-react';
import { formatSaleAmount } from '@/lib/currency';

export interface CostSummary {
  period: { from: string | null; to: string | null };
  warehouseId: string | null;
  purchase: { UZS: number; USD: number };
  sales: { UZS: number; USD: number };
  profit: { UZS: number; USD: number };
  margin: { UZS: number; USD: number };
  inventoryValue: { UZS: number; USD: number };
  counts: {
    purchaseMovements: number;
    salesMovements: number;
    stockLines: number;
  };
}

export interface DailyPoint {
  date: string;
  purchase: { UZS: number; USD: number };
  sales: { UZS: number; USD: number };
  profit: { UZS: number; USD: number };
}

export interface TopProduct {
  productVariantId: string;
  productName: string;
  variantName: string;
  sku: string | null;
  currency: 'UZS' | 'USD';
  quantity: number;
  revenue: number;
}

export interface FieldWorkerInstallRow {
  userId: string;
  name: string;
  tasksTotal: number;
  approved: number;
  usedQty: number;
  returnedQty: number;
  lostQty: number;
}

export type ReportStatCard = {
  key: string;
  label: string;
  sub: string;
  value: { UZS: number; USD: number };
  format: (n: number, c: 'UZS' | 'USD') => string;
  icon: LucideIcon;
  color: string;
  bg: string;
  ring: string;
  margin?: { UZS: number; USD: number };
};

export const todayStr = () => new Date().toISOString().slice(0, 10);

export const monthStartStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

export const compactNumber = (n: number) => {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
};

export function buildReportStats(summary: CostSummary): ReportStatCard[] {
  const fmt = (n: number, c: 'UZS' | 'USD') => formatSaleAmount(n, c);

  return [
    {
      key: 'purchase',
      label: 'Kirim summasi',
      sub: 'Hamkorlardan rasmiy qabul (GoodsReceipt)',
      value: summary.purchase,
      format: fmt,
      icon: ArrowDownToLine,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10',
      ring: 'ring-amber-500/20',
    },
    {
      key: 'sales',
      label: 'Sotuv summasi',
      sub: 'Chiqimlar × katalog sotuv narxi (chek narxi emas)',
      value: summary.sales,
      format: fmt,
      icon: ArrowUpFromLine,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      ring: 'ring-emerald-500/20',
    },
    {
      key: 'profit',
      label: 'Foyda',
      sub: 'Sotuv − Kirim (COGS / xarajatlar emas)',
      value: summary.profit,
      format: fmt,
      icon: TrendingUp,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      ring: 'ring-blue-500/20',
      margin: summary.margin,
    },
    {
      key: 'inventory',
      label: 'Ombor qiymati (hozir)',
      sub: 'Joriy qoldiq × kirim narxi',
      value: summary.inventoryValue,
      format: fmt,
      icon: WarehouseIcon,
      color: 'text-cyan-400',
      bg: 'bg-cyan-500/10',
      ring: 'ring-cyan-500/20',
    },
  ];
}
