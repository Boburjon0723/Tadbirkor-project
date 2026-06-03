import {
  ArrowUpRight,
  Clock,
  CheckCircle2,
  GitBranch,
  type LucideIcon,
} from 'lucide-react';
import {
  formatSaleAmount,
  formatSaleAmountMap,
  normalizeSaleCurrency,
  type SaleCurrency,
} from '@/lib/currency';

export function formatOrderAmount(value: number, currency: 'UZS' | 'USD' = 'UZS') {
  return formatSaleAmount(value, normalizeSaleCurrency(currency));
}

/** Buyurtma qatorlaridan valyuta (ro‘yxat yoki tafsilot) */
export function resolveOrderCurrency(order: {
  items?: Array<{ expectedCurrency?: string | null }>;
  displayCurrency?: string | null;
} | null | undefined): SaleCurrency {
  const fromOrder = order?.displayCurrency;
  if (fromOrder) return normalizeSaleCurrency(fromOrder);
  for (const item of order?.items || []) {
    if (item.expectedCurrency) return normalizeSaleCurrency(item.expectedCurrency);
  }
  return 'UZS';
}

export function orderItemsCount(order: any): number {
  return order?._count?.items ?? order?.items?.length ?? 0;
}

/** Katalogdan buyurtma: seller variant ID bor; yoki mappingStatus MAPPED */
export function isOrderLineMapped(item: {
  mappingStatus?: string | null;
  productVariantId?: string | null;
}): boolean {
  return item.mappingStatus === 'MAPPED' || Boolean(item.productVariantId);
}

export function orderHasUnmappedItems(order: { items?: any[]; unmappedItemCount?: number } | null | undefined): boolean {
  if (typeof order?.unmappedItemCount === 'number') {
    return order.unmappedItemCount > 0;
  }
  return (order?.items ?? []).some((item) => !isOrderLineMapped(item));
}

export function formatOrderAmountSummary(summary?: {
  byCurrency?: Record<string, number>;
} | null) {
  const by = summary?.byCurrency;
  if (!by || !Object.keys(by).length) return '—';
  const parts = Object.entries(by)
    .filter(([, v]) => Number(v) > 0)
    .map(([cur, val]) => formatSaleAmount(val, normalizeSaleCurrency(cur)));
  return parts.join(' · ') || '—';
}

/** Ro‘yxat API dan kelgan qisqa qator — to‘liq mapping maydonlari yo‘q */
export function orderItemsLackMappingFields(order: { items?: any[] } | null | undefined): boolean {
  const items = order?.items ?? [];
  if (items.length === 0) return true;
  return items.every(
    (i) => i.mappingStatus === undefined && i.productVariantId === undefined,
  );
}

export function orderLineOrderedQty(item: { orderedQuantity?: number; quantity?: unknown }) {
  const q = item.orderedQuantity ?? item.quantity;
  return Number(q) || 0;
}

export function orderLineDispatchedQty(item: {
  dispatchedQuantity?: number;
  orderedQuantity?: number;
  quantity?: unknown;
}) {
  if (item.dispatchedQuantity !== undefined && item.dispatchedQuantity !== null) {
    return Number(item.dispatchedQuantity) || 0;
  }
  return 0;
}

export function orderLineRemainingQty(item: {
  remainingToDispatch?: number;
  orderedQuantity?: number;
  dispatchedQuantity?: number;
  quantity?: unknown;
}) {
  if (item.remainingToDispatch !== undefined && item.remainingToDispatch !== null) {
    return Math.max(0, Number(item.remainingToDispatch) || 0);
  }
  return Math.max(0, orderLineOrderedQty(item) - orderLineDispatchedQty(item));
}

export function orderCanDispatchMore(order: {
  status?: string;
  canDispatchMore?: boolean;
  isPartialDispatch?: boolean;
  items?: any[];
} | null | undefined): boolean {
  if (!order) return false;
  const hasRemaining = (order.items ?? []).some((i) => orderLineRemainingQty(i) > 0);
  if (!hasRemaining) return false;

  const blocked = ['DRAFT', 'SENT', 'REJECTED', 'CANCELLED', 'COMPLETED'];
  if (blocked.includes(order.status || '')) return false;

  if (order.canDispatchMore === true) return true;

  return (
    order.status === 'ACCEPTED' ||
    order.status === 'PARTIALLY_DISPATCHED' ||
    order.status === 'RECEIVED' ||
    order.status === 'DISPATCHED'
  );
}

export function orderCanCloseRemainder(order: {
  isPartialDispatch?: boolean;
  status?: string;
  items?: any[];
} | null | undefined): boolean {
  if (!order?.isPartialDispatch) return false;
  if (!['PARTIALLY_DISPATCHED', 'DISPATCHED', 'RECEIVED'].includes(order.status || '')) {
    return false;
  }
  return (order.items ?? []).some((i) => orderLineRemainingQty(i) > 0);
}

export function orderHasDispatchInfo(order: { hasDispatch?: boolean; items?: any[] }) {
  if (order?.hasDispatch) return true;
  return (order?.items ?? []).some((i) => i.dispatchedQuantity !== undefined);
}

export function getOrderTotal(order: any) {
  const items = order?.items || [];
  if (items.length === 0) {
    return { label: '—', mixed: false };
  }

  const byCurrency: Partial<Record<SaleCurrency, number>> = {};
  for (const item of items) {
    const cur = normalizeSaleCurrency(item.expectedCurrency);
    const line =
      orderLineOrderedQty(item) * Number(item.expectedPrice ?? item.price ?? 0);
    if (!Number.isFinite(line)) continue;
    byCurrency[cur] = (byCurrency[cur] || 0) + line;
  }

  const active = (Object.keys(byCurrency) as SaleCurrency[]).filter(
    (c) => (byCurrency[c] || 0) > 0,
  );

  if (active.length === 0 && order?.displayCurrency) {
    return {
      label: formatSaleAmount(0, resolveOrderCurrency(order)),
      mixed: false,
    };
  }

  if (active.length > 1) {
    return { label: formatSaleAmountMap(byCurrency), mixed: true };
  }

  const currency = active[0] || resolveOrderCurrency(order);
  return {
    label: formatSaleAmount(byCurrency[currency] || 0, currency),
    mixed: false,
  };
}

export function getDispatchedOrderTotal(order: any) {
  const items = order?.items || [];
  if (items.length === 0) {
    return { label: '—', mixed: false };
  }

  const byCurrency: Partial<Record<SaleCurrency, number>> = {};
  for (const item of items) {
    const cur = normalizeSaleCurrency(item.expectedCurrency);
    const line =
      orderLineDispatchedQty(item) * Number(item.expectedPrice ?? item.price ?? 0);
    if (!Number.isFinite(line)) continue;
    byCurrency[cur] = (byCurrency[cur] || 0) + line;
  }

  const active = (Object.keys(byCurrency) as SaleCurrency[]).filter(
    (c) => (byCurrency[c] || 0) > 0,
  );

  if (active.length > 1) {
    return { label: formatSaleAmountMap(byCurrency), mixed: true };
  }

  const currency = active[0] || resolveOrderCurrency(order);
  return {
    label: formatSaleAmount(byCurrency[currency] || 0, currency),
    mixed: false,
  };
}

export function getOrderStatusStyle(status: string) {
  switch (status) {
    case 'DRAFT':
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    case 'SENT':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    case 'ACCEPTED':
      return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    case 'PARTIAL_ACCEPTED':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'IN_PROGRESS':
      return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20';
    case 'DISPATCHED':
      return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    case 'PARTIALLY_DISPATCHED':
      return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    case 'RECEIVED':
      return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
    case 'COMPLETED':
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    case 'REJECTED':
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    case 'CANCELLED':
      return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    default:
      return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
  }
}

export function orderStatusLabelUz(status: string) {
  const labels: Record<string, string> = {
    DRAFT: 'Qoralama',
    SENT: 'Yuborilgan',
    ACCEPTED: 'Buyurtma qabul qilingan',
    PARTIAL_ACCEPTED: 'Qisman qabul (ATP)',
    REJECTED: 'Rad etilgan',
    IN_PROGRESS: 'Jarayonda',
    DISPATCHED: "Jo'natilgan",
    PARTIALLY_DISPATCHED: "Qisman jo'natilgan",
    RECEIVED: 'Yetkazib olindi',
    COMPLETED: 'Yakunlangan',
    CANCELLED: 'Bekor qilingan',
  };
  return labels[status] ?? status;
}

export function filterOrdersBySearch(orders: any[] | undefined, term: string): any[] {
  const q = term.trim().toLowerCase();
  if (!q) return orders || [];
  return (orders || []).filter((order) => {
    const id = String(order.id || '').toLowerCase();
    const seller = String(order.seller?.name || '').toLowerCase();
    const buyer = String(order.buyer?.name || '').toLowerCase();
    return id.includes(q) || seller.includes(q) || buyer.includes(q);
  });
}

export type OrderStatCard = {
  title: string;
  value: number;
  icon: LucideIcon;
  color: 'blue' | 'amber' | 'emerald' | 'red';
};

export function buildOrderStats(myOrders: any[] | undefined, incomingOrders: any[] | undefined): OrderStatCard[] {
  return [
    {
      title: 'Yuborilgan',
      value: myOrders?.filter((o: any) => o.status === 'SENT').length || 0,
      icon: ArrowUpRight,
      color: 'blue',
    },
    {
      title: 'Qabul kutilmoqda',
      value: incomingOrders?.filter((o: any) => o.status === 'SENT').length || 0,
      icon: Clock,
      color: 'amber',
    },
    {
      title: 'Qabul qilinganlar',
      value:
        (myOrders?.filter((o: any) => o.status === 'ACCEPTED').length || 0) +
        (incomingOrders?.filter((o: any) => o.status === 'ACCEPTED').length || 0),
      icon: CheckCircle2,
      color: 'emerald',
    },
    {
      title: 'Mapping kerak',
      value:
        incomingOrders?.filter((o: any) =>
          o.items?.some((i: any) => i.mappingStatus !== 'MAPPED'),
        ).length || 0,
      icon: GitBranch,
      color: 'red',
    },
  ];
}

export function buildOrderStatsFromHub(hub?: {
  my?: { sent?: number; accepted?: number };
  incoming?: { sent?: number; accepted?: number; mappingNeeded?: number };
}): OrderStatCard[] {
  const my = hub?.my;
  const incoming = hub?.incoming;
  return [
    {
      title: 'Yuborilgan',
      value: Number(my?.sent || 0),
      icon: ArrowUpRight,
      color: 'blue',
    },
    {
      title: 'Qabul kutilmoqda',
      value: Number(incoming?.sent || 0),
      icon: Clock,
      color: 'amber',
    },
    {
      title: 'Qabul qilinganlar',
      value: Number(my?.accepted || 0) + Number(incoming?.accepted || 0),
      icon: CheckCircle2,
      color: 'emerald',
    },
    {
      title: 'Mapping kerak',
      value: Number(incoming?.mappingNeeded || 0),
      icon: GitBranch,
      color: 'red',
    },
  ];
}

export function orderPartner(order: any, activeTab: 'my' | 'incoming') {
  return activeTab === 'my' ? order.seller : order.buyer;
}

export function orderPartnerName(order: any, activeTab: 'my' | 'incoming') {
  return orderPartner(order, activeTab)?.name || '—';
}

export function orderPartnerCompanyId(order: any, activeTab: 'my' | 'incoming') {
  if (activeTab === 'my') {
    return order.sellerCompanyId || order.seller?.id || '';
  }
  return order.buyerCompanyId || order.buyer?.id || '';
}

export type PartnerOrderGroup = {
  partnerCompanyId: string;
  partner: { name: string; tin?: string | null };
  orders: any[];
  orderCount: number;
  aggregateStatus: string;
  latestOrderAt: Date;
};

const ORDER_STATUS_PRIORITY: Record<string, number> = {
  SENT: 0,
  ACCEPTED: 1,
  PARTIAL_ACCEPTED: 1,
  IN_PROGRESS: 2,
  PARTIALLY_DISPATCHED: 3,
  DISPATCHED: 4,
  RECEIVED: 5,
  COMPLETED: 6,
  REJECTED: 7,
  CANCELLED: 8,
  DRAFT: 9,
};

function pickAggregateOrderStatus(orders: any[]): string {
  let status = orders[0]?.status ?? 'DRAFT';
  let priority = ORDER_STATUS_PRIORITY[status] ?? 99;
  for (const order of orders) {
    const p = ORDER_STATUS_PRIORITY[order.status] ?? 99;
    if (p < priority) {
      priority = p;
      status = order.status;
    }
  }
  return status;
}

export function sumOrdersGroupTotals(orders: any[]) {
  const byCurrency: Partial<Record<SaleCurrency, number>> = {};
  for (const order of orders) {
    for (const item of order?.items || []) {
      const cur = normalizeSaleCurrency(item.expectedCurrency);
      const line =
        orderLineOrderedQty(item) * Number(item.expectedPrice ?? item.price ?? 0);
      if (!Number.isFinite(line)) continue;
      byCurrency[cur] = (byCurrency[cur] || 0) + line;
    }
  }
  return byCurrency;
}

export function formatOrdersGroupTotalLabel(orders: any[]) {
  const byCurrency = sumOrdersGroupTotals(orders);
  const active = (Object.keys(byCurrency) as SaleCurrency[]).filter(
    (c) => (byCurrency[c] || 0) > 0,
  );
  if (active.length === 0) return '—';
  if (active.length > 1) return formatSaleAmountMap(byCurrency);
  const currency = active[0];
  return formatSaleAmount(byCurrency[currency] || 0, currency);
}

export function groupOrdersByPartner(
  orders: any[] | undefined,
  activeTab: 'my' | 'incoming',
): PartnerOrderGroup[] {
  const map = new Map<string, PartnerOrderGroup>();

  for (const order of orders || []) {
    const partnerId = orderPartnerCompanyId(order, activeTab);
    if (!partnerId) continue;

    const partner = orderPartner(order, activeTab);
    if (!map.has(partnerId)) {
      map.set(partnerId, {
        partnerCompanyId: partnerId,
        partner: { name: partner?.name || '—', tin: partner?.tin },
        orders: [],
        orderCount: 0,
        aggregateStatus: order.status,
        latestOrderAt: new Date(order.createdAt),
      });
    }

    const group = map.get(partnerId)!;
    group.orders.push(order);
    group.orderCount += 1;
    const createdAt = new Date(order.createdAt);
    if (createdAt > group.latestOrderAt) {
      group.latestOrderAt = createdAt;
    }
  }

  const groups = Array.from(map.values()).map((g) => ({
    ...g,
    aggregateStatus: pickAggregateOrderStatus(g.orders),
    orders: [...g.orders].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  }));

  return groups.sort((a, b) =>
    a.partner.name.localeCompare(b.partner.name, 'uz'),
  );
}

export function orderDisplayId(orderId: string) {
  return `ORD-${orderId.slice(0, 8).toUpperCase()}`;
}
